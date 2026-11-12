# ZALS テーブル項目一覧（16テーブル・264項目）

この一覧は提供されたGDataHub画面の見出し／検索欄から収集された物理項目名の転記です。**公式テーブル定義・データ取得成功の保証ではありません**。データ型、桁数、主キー、NULL許可、画面にない列、正式な業務定義は未確認です。顧客・契約情報などの実データは掲載していません。

| No. | テーブル（ZALS） | 画面キャプション | 項目数 |
| ---: | --- | --- | ---: |
| 1 | `ZALDTB_ORDER_INFO` | オーダー情報 | 39 |
| 2 | `ZGDDTB_CONTRACT_INFO` | 契約情報 | 19 |
| 3 | `ZGDDTB_INSTALLATION_INFO` | 設置情報 | 15 |
| 4 | `ZGDDTB_NC_INFO_RS` | NC情報リレーションテーブル | 18 |
| 5 | `ZGDDTB_SALES_INFO` | 販売情報 | 16 |
| 6 | `ZGDDTB_SHIPPING_INFO` | 出荷情報 | 15 |
| 7 | `ZGDDTB_STOCK_INFO` | 在庫情報 | 12 |
| 8 | `ZGDDTB_WAREHOUSE_INV_INFO` | 倉庫在庫情報 | 21 |
| 9 | `ZGDDTM_COUNTRY` | 国マスタ | 13 |
| 10 | `ZGDDTM_CUSTOMER` | 顧客マスタ | 18 |
| 11 | `ZGDDTM_CUSTOMER_ADDRESS` | 顧客住所マスタ | 12 |
| 12 | `ZGDDTM_MACHINERY_TOOL` | 工作機械マスタ | 13 |
| 13 | `ZGDDTM_NC_MODEL` | NCモデルマスタ | 15 |
| 14 | `ZGDDTM_SERVICE_LOCATION` | サービス拠点マスタ | 13 |
| 15 | `ZGDDTM_WAREHOUSE` | 倉庫マスタ | 16 |
| 16 | `ZGDDTM_WAREHOUSE_TYPE` | 倉庫タイプマスタ | 9 |
| **計** | **16テーブル** | | **264** |

## 1. オーダー情報（`ZALDTB_ORDER_INFO`）

| No. | 項目名（物理名） |
| ---: | --- |
| 1 | `request_no` |
| 2 | `sales_office_id` |
| 3 | `ins_date` |
| 4 | `inquiry_date` |
| 5 | `inquiry_type` |
| 6 | `alarm` |
| 7 | `inquiry_details` |
| 8 | `caller_id` |
| 9 | `caller_company_name` |
| 10 | `caller_contact_id` |
| 11 | `caller_contact_phone` |
| 12 | `caller_contact_email` |
| 13 | `customer_id` |
| 14 | `customer_company_name` |
| 15 | `customer_contact_id` |
| 16 | `customer_contact_phone` |
| 17 | `customer_contact_email` |
| 18 | `machinery_descr` |
| 19 | `serial_no` |
| 20 | `assigned_staff_id` |
| 21 | `order_status` |
| 22 | `work_status` |
| 23 | `preparatory_parts` |
| 24 | `work_progress` |
| 25 | `estimated_no` |
| 26 | `report_no` |
| 27 | `report_date` |
| 28 | `result` |
| 29 | `used_parts` |
| 30 | `confidential_information` |
| 31 | `del_flg` |
| 32 | `resolve_flg` |
| 33 | `ins_user_id` |
| 34 | `upd_user_id` |
| 35 | `ins_id` |
| 36 | `ins_pgmid` |
| 37 | `upd_date` |
| 38 | `upd_id` |
| 39 | `upd_pgmid` |

## 2. 契約情報（`ZGDDTB_CONTRACT_INFO`）

| No. | 項目名（物理名） |
| ---: | --- |
| 1 | `contract_id` |
| 2 | `contract_no` |
| 3 | `contract_type` |
| 4 | `contract_period` |
| 5 | `contract_start_date` |
| 6 | `contract_end_date` |
| 7 | `contract_from_location_code` |
| 8 | `contractor_id` |
| 9 | `contract_notes` |
| 10 | `nc_serial_no` |
| 11 | `del_flg` |
| 12 | `ins_user_id` |
| 13 | `upd_user_id` |
| 14 | `ins_date` |
| 15 | `ins_id` |
| 16 | `ins_pgmid` |
| 17 | `upd_date` |
| 18 | `upd_id` |
| 19 | `upd_pgmid` |

## 3. 設置情報（`ZGDDTB_INSTALLATION_INFO`）

| No. | 項目名（物理名） |
| ---: | --- |
| 1 | `installation_id` |
| 2 | `installation_date` |
| 3 | `enduser_id` |
| 4 | `installation_address_id` |
| 5 | `enduser_notes` |
| 6 | `nc_serial_no` |
| 7 | `del_flg` |
| 8 | `ins_user_id` |
| 9 | `upd_user_id` |
| 10 | `ins_date` |
| 11 | `ins_id` |
| 12 | `ins_pgmid` |
| 13 | `upd_date` |
| 14 | `upd_id` |
| 15 | `upd_pgmid` |

## 4. NC情報リレーションテーブル（`ZGDDTB_NC_INFO_RS`）

| No. | 項目名（物理名） |
| ---: | --- |
| 1 | `nc_serial_no` |
| 2 | `nc_model_id` |
| 3 | `machinery_tool_id` |
| 4 | `shipped_nc_system_model_name` |
| 5 | `nc_bom_no` |
| 6 | `nc_delivery_spec_no` |
| 7 | `sales_company_location_code` |
| 8 | `service_location_code` |
| 9 | `machinery_notes` |
| 10 | `del_flg` |
| 11 | `ins_user_id` |
| 12 | `upd_user_id` |
| 13 | `ins_date` |
| 14 | `ins_id` |
| 15 | `ins_pgmid` |
| 16 | `upd_date` |
| 17 | `upd_id` |
| 18 | `upd_pgmid` |

## 5. 販売情報（`ZGDDTB_SALES_INFO`）

| No. | 項目名（物理名） |
| ---: | --- |
| 1 | `sales_id` |
| 2 | `sales_date` |
| 3 | `sales_company_location_code` |
| 4 | `machinery_dealer_id` |
| 5 | `machinery_dealer_address_id` |
| 6 | `sales_notes` |
| 7 | `nc_serial_no` |
| 8 | `del_flg` |
| 9 | `ins_user_id` |
| 10 | `upd_user_id` |
| 11 | `ins_date` |
| 12 | `ins_id` |
| 13 | `ins_pgmid` |
| 14 | `upd_date` |
| 15 | `upd_id` |
| 16 | `upd_pgmid` |

## 6. 出荷情報（`ZGDDTB_SHIPPING_INFO`）

| No. | 項目名（物理名） |
| ---: | --- |
| 1 | `shipping_id` |
| 2 | `shipping_from_country_code` |
| 3 | `shipping_to_country_code` |
| 4 | `machine_shipping_date` |
| 5 | `shipping_notes` |
| 6 | `nc_serial_no` |
| 7 | `del_flg` |
| 8 | `ins_user_id` |
| 9 | `upd_user_id` |
| 10 | `ins_date` |
| 11 | `ins_id` |
| 12 | `ins_pgmid` |
| 13 | `upd_date` |
| 14 | `upd_id` |
| 15 | `upd_pgmid` |

## 7. 在庫情報（`ZGDDTB_STOCK_INFO`）

| No. | 項目名（物理名） |
| ---: | --- |
| 1 | `material` |
| 2 | `plant` |
| 3 | `warehouse_id` |
| 4 | `batch_code` |
| 5 | `unrestricteduse_stock_qty` |
| 6 | `unit` |
| 7 | `transfer_stock_qty` |
| 8 | `qualityinspection_stock_qty` |
| 9 | `restricteduse_stock_qty` |
| 10 | `blocked_stock_qty` |
| 11 | `returns_stock_qty` |
| 12 | `material_description` |

## 8. 倉庫在庫情報（`ZGDDTB_WAREHOUSE_INV_INFO`）

| No. | 項目名（物理名） |
| ---: | --- |
| 1 | `sales_office_id` |
| 2 | `material` |
| 3 | `werks` |
| 4 | `warehouse_id` |
| 5 | `batch_code` |
| 6 | `unrestricteduse_stock_qty` |
| 7 | `unit` |
| 8 | `transfer_stock_qty` |
| 9 | `qualityinspection_stock_qty` |
| 10 | `restricteduse_stock_qty` |
| 11 | `blocked_stock_qty` |
| 12 | `returns_stock_qty` |
| 13 | `material_name` |
| 14 | `processing_flg` |
| 15 | `del_flg` |
| 16 | `ins_date` |
| 17 | `ins_id` |
| 18 | `ins_pgmid` |
| 19 | `upd_date` |
| 20 | `upd_id` |
| 21 | `upd_pgmid` |

## 9. 国マスタ（`ZGDDTM_COUNTRY`）

| No. | 項目名（物理名） |
| ---: | --- |
| 1 | `country_code` |
| 2 | `country_code_alpha3` |
| 3 | `country_name` |
| 4 | `sort_key` |
| 5 | `del_flg` |
| 6 | `ins_user_id` |
| 7 | `upd_user_id` |
| 8 | `ins_date` |
| 9 | `ins_id` |
| 10 | `ins_pgmid` |
| 11 | `upd_date` |
| 12 | `upd_id` |
| 13 | `upd_pgmid` |

## 10. 顧客マスタ（`ZGDDTM_CUSTOMER`）

| No. | 項目名（物理名） |
| ---: | --- |
| 1 | `customer_id` |
| 2 | `customer_name` |
| 3 | `site_name` |
| 4 | `department_name` |
| 5 | `enduser_flg` |
| 6 | `machinery_dealer_flg` |
| 7 | `machinery_vend_flg` |
| 8 | `contact_phone` |
| 9 | `customer_notes` |
| 10 | `del_flg` |
| 11 | `ins_user_id` |
| 12 | `upd_user_id` |
| 13 | `ins_date` |
| 14 | `ins_id` |
| 15 | `ins_pgmid` |
| 16 | `upd_date` |
| 17 | `upd_id` |
| 18 | `upd_pgmid` |

## 11. 顧客住所マスタ（`ZGDDTM_CUSTOMER_ADDRESS`）

| No. | 項目名（物理名） |
| ---: | --- |
| 1 | `customer_address_id` |
| 2 | `customer_id` |
| 3 | `address` |
| 4 | `del_flg` |
| 5 | `ins_user_id` |
| 6 | `upd_user_id` |
| 7 | `ins_date` |
| 8 | `ins_id` |
| 9 | `ins_pgmid` |
| 10 | `upd_date` |
| 11 | `upd_id` |
| 12 | `upd_pgmid` |

## 12. 工作機械マスタ（`ZGDDTM_MACHINERY_TOOL`）

| No. | 項目名（物理名） |
| ---: | --- |
| 1 | `machinery_tool_id` |
| 2 | `machinery_tool_serial_no` |
| 3 | `machinery_tool_model_no` |
| 4 | `machinery_vendor_id` |
| 5 | `del_flg` |
| 6 | `ins_user_id` |
| 7 | `upd_user_id` |
| 8 | `ins_date` |
| 9 | `ins_id` |
| 10 | `ins_pgmid` |
| 11 | `upd_date` |
| 12 | `upd_id` |
| 13 | `upd_pgmid` |

## 13. NCモデルマスタ（`ZGDDTM_NC_MODEL`）

| No. | 項目名（物理名） |
| ---: | --- |
| 1 | `nc_model_id` |
| 2 | `nc_series_name` |
| 3 | `model_name` |
| 4 | `nc_system_model_name` |
| 5 | `control_unit` |
| 6 | `display_unit` |
| 7 | `del_flg` |
| 8 | `ins_user_id` |
| 9 | `upd_user_id` |
| 10 | `ins_date` |
| 11 | `ins_id` |
| 12 | `ins_pgmid` |
| 13 | `upd_date` |
| 14 | `upd_id` |
| 15 | `upd_pgmid` |

## 14. サービス拠点マスタ（`ZGDDTM_SERVICE_LOCATION`）

| No. | 項目名（物理名） |
| ---: | --- |
| 1 | `service_location_code` |
| 2 | `service_location_name` |
| 3 | `country_code` |
| 4 | `sort_key` |
| 5 | `del_flg` |
| 6 | `ins_user_id` |
| 7 | `upd_user_id` |
| 8 | `ins_date` |
| 9 | `ins_id` |
| 10 | `ins_pgmid` |
| 11 | `upd_date` |
| 12 | `upd_id` |
| 13 | `upd_pgmid` |

## 15. 倉庫マスタ（`ZGDDTM_WAREHOUSE`）

| No. | 項目名（物理名） |
| ---: | --- |
| 1 | `company_id` |
| 2 | `werks` |
| 3 | `core_warehouse_id` |
| 4 | `astea_warehouse_id` |
| 5 | `ekorg` |
| 6 | `existence_cd` |
| 7 | `warehouse_name` |
| 8 | `warehouse_type` |
| 9 | `branch_cd` |
| 10 | `del_flg` |
| 11 | `ins_date` |
| 12 | `ins_id` |
| 13 | `ins_pgmid` |
| 14 | `upd_date` |
| 15 | `upd_id` |
| 16 | `upd_pgmid` |

## 16. 倉庫タイプマスタ（`ZGDDTM_WAREHOUSE_TYPE`）

| No. | 項目名（物理名） |
| ---: | --- |
| 1 | `warehouse_type` |
| 2 | `warehouse_type_text` |
| 3 | `del_flg` |
| 4 | `ins_date` |
| 5 | `ins_id` |
| 6 | `ins_pgmid` |
| 7 | `upd_date` |
| 8 | `upd_id` |
| 9 | `upd_pgmid` |

