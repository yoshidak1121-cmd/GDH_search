using System;
using System.IO;
using System.Collections.Generic;
using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;
public class GdhNativeHost {
    static JavaScriptSerializer Json = new JavaScriptSerializer();
    static string Root = AppDomain.CurrentDomain.BaseDirectory;
    static Stream Output = Console.OpenStandardOutput();
    static void Send(object value) {
        byte[] bytes = Encoding.UTF8.GetBytes(Json.Serialize(value));
        byte[] length = BitConverter.GetBytes(bytes.Length);
        Output.Write(length,0,4);Output.Write(bytes,0,bytes.Length);Output.Flush();
    }
    static void Fail(string code) { Send(new {ok=false,code=code}); }
    static byte[] Read(Stream input, int count) {
        byte[] buffer = new byte[count];int offset=0;
        while(offset<count){int n=input.Read(buffer,offset,count-offset);if(n==0)throw new IOException();offset+=n;}
        return buffer;
    }
    static Dictionary<string,object> Load(string path) {
        return Json.Deserialize<Dictionary<string,object>>(File.ReadAllText(path,Encoding.UTF8));
    }
    static string InstalledVersion() {
        var manifest=Load(Path.Combine(Root,"Extension","manifest.json"));
        if((string)manifest["name"]!="GDH \u6a5f\u68b0\u60c5\u5831 \u62e1\u5f35\u691c\u7d22")throw new IOException();
        return (string)manifest["version"];
    }
    public static int Main(string[] args) {
        try {
            var manifest=Load(Path.Combine(Root,"com.yoshidak.gdh_search_updater.json"));
            var origins=Json.ConvertToType<string[]>(manifest["allowed_origins"]);
            if(args.Length<1||Array.IndexOf(origins,args[0])<0){Fail("ORIGIN_DENIED");return 1;}
            Stream input=Console.OpenStandardInput();int size=BitConverter.ToInt32(Read(input,4),0);
            if(size<1||size>4096){Fail("INVALID_REQUEST");return 1;}
            var request=Json.Deserialize<Dictionary<string,object>>(Encoding.UTF8.GetString(Read(input,size)));
            string action=request.ContainsKey("action")?request["action"] as string:null;
            if(action=="ping"){Send(new {ok=true,version=InstalledVersion()});return 0;}
            string version=request.ContainsKey("version")?request["version"] as string:null;
            if(action!="update"||version==null||!Regex.IsMatch(version,@"\A[0-9]+\.[0-9]+\.[0-9]+\z")){Fail("INVALID_REQUEST");return 1;}
            string script=Path.Combine(Root,"Update.ps1");
            if(!File.Exists(script)){Fail("HELPER_MISSING");return 1;}
            var start=new ProcessStartInfo();
            start.FileName=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"WindowsPowerShell","v1.0","powershell.exe");
            start.Arguments="-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File \""+script+"\" -Silent -ExpectedVersion "+version;
            start.UseShellExecute=false;start.CreateNoWindow=true;start.RedirectStandardOutput=true;start.RedirectStandardError=true;
            using(var process=Process.Start(start)){
                process.OutputDataReceived+=(s,e)=>{};process.ErrorDataReceived+=(s,e)=>{};
                process.BeginOutputReadLine();process.BeginErrorReadLine();
                var watch=Stopwatch.StartNew();
                while(!process.WaitForExit(1000)){
                    if(watch.Elapsed.TotalSeconds>240){
                        var kill=new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"taskkill.exe"),"/PID "+process.Id+" /T /F");
                        kill.UseShellExecute=false;kill.CreateNoWindow=true;kill.RedirectStandardOutput=true;kill.RedirectStandardError=true;
                        using(var stop=Process.Start(kill)){stop.StandardOutput.ReadToEnd();stop.StandardError.ReadToEnd();stop.WaitForExit(10000);}
                        Fail("UPDATE_TIMEOUT");return 1;
                    }
                    if(((int)watch.Elapsed.TotalSeconds)%5==0)Send(new {type="progress",phase="installing"});
                }
                process.WaitForExit();
                if(process.ExitCode!=0||InstalledVersion()!=version){Fail("UPDATE_FAILED");return 1;}
            }
            Send(new {ok=true,version=version});return 0;
        }catch(Exception error){Fail("HELPER_"+error.GetType().Name);return 1;}
    }
}
