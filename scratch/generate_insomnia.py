import json
import time

now_ms = int(time.time() * 1000)

resources = [
    {
        "_id": "wrk_ev_charging",
        "_type": "workspace",
        "parentId": None,
        "modified": now_ms,
        "created": now_ms,
        "name": "EVC - V1",
        "description": "Insomnia API Collection for EV Charging Reservation System",
        "scope": "collection"
    },
    {
        "_id": "env_ev_charging_base",
        "_type": "environment",
        "parentId": "wrk_ev_charging",
        "modified": now_ms,
        "created": now_ms,
        "name": "Base Environment",
        "data": {
            "base_url": "http://localhost:3000",
            "license": "LIC001",
            "lic_code": "LIC001",
            "auth_username": "tmsv2.website",
            "auth_password": "reP@ssw0rd778900"
        },
        "dataPropertyOrder": {
            "&": ["base_url", "license", "lic_code", "auth_username", "auth_password"]
        },
        "color": None,
        "isPrivate": False,
        "metaSortKey": now_ms
    }
]

headers_default = [
    {"name": "Content-Type", "value": "application/json"},
    {"name": "lic_code", "value": "{{ _.license }}"}
]

auth_basic = {
    "type": "basic",
    "username": "tmsv2.website",
    "password": "reP@ssw0rd778900"
}

# Folders
folders = [
    # Station
    {"id": "fld_station_main", "parent": "wrk_ev_charging", "name": "ข้อมูลสถานี – Station", "sort": 100, "has_auth": True},
    # Station Charger Connector
    {"id": "fld_station_charger_main", "parent": "wrk_ev_charging", "name": "ข้อมูลสถานีที่สำหรับจ่ายไฟ", "sort": 200, "has_auth": True},
    # Charger
    {"id": "fld_charger_main", "parent": "wrk_ev_charging", "name": "ข้อมูลตู้ชาร์จ – Charger", "sort": 300, "has_auth": True},
    # Connector
    {"id": "fld_connector_main", "parent": "wrk_ev_charging", "name": "ข้อมูลหัวชาร์จ – Connector", "sort": 400, "has_auth": True},
    # Authority
    {"id": "fld_authority_main", "parent": "wrk_ev_charging", "name": "ข้อมูลสิทธิ์การใช้งาน – Authority", "sort": 500, "has_auth": True},
    # Users
    {"id": "fld_users_main", "parent": "wrk_ev_charging", "name": "ข้อมูลผู้ใช้งาน – Users", "sort": 600, "has_auth": True},

    # Main Folder: ข้อมูลรถ - Vehicle
    {"id": "fld_vehicle_main", "parent": "wrk_ev_charging", "name": "ข้อมูลรถ – Vehicle", "sort": 700, "has_auth": True},
    {"id": "fld_vehicle_info", "parent": "fld_vehicle_main", "name": "ข้อมูลรถ – Vehicle", "sort": 710, "has_auth": False},
    {"id": "fld_vehicle_brand", "parent": "fld_vehicle_main", "name": "ข้อมูลแบรนด์รถ – Brand Vehicle", "sort": 720, "has_auth": False},
    {"id": "fld_vehicle_model", "parent": "fld_vehicle_main", "name": "ข้อมูลโมเดลรถ – Model Vehicle", "sort": 730, "has_auth": False},
    {"id": "fld_vehicle_type", "parent": "fld_vehicle_main", "name": "ข้อมูลประเภทรถ – Type Vehicle", "sort": 740, "has_auth": False},
    
    # Reservation
    {"id": "fld_reservation_main", "parent": "wrk_ev_charging", "name": "ข้อมูลการจอง – Reservation", "sort": 800, "has_auth": True},
    # Auth
    {"id": "fld_auth_main", "parent": "wrk_ev_charging", "name": "การยืนยันตัวตน – Auth", "sort": 900, "has_auth": True},
]

for f in folders:
    folder_res = {
        "_id": f["id"],
        "_type": "request_group",
        "parentId": f["parent"],
        "modified": now_ms,
        "created": now_ms,
        "name": f["name"],
        "description": "",
        "environment": {},
        "environmentPropertyOrder": None,
        "metaSortKey": f["sort"]
    }
    if f["has_auth"]:
        folder_res["authentication"] = auth_basic
    else:
        folder_res["authentication"] = {}
    resources.append(folder_res)

requests = [
    # --- 1. Station ---
    {
        "id": "req_stn_get",
        "parent": "fld_station_main",
        "name": "ดึงข้อมูล – สถานี",
        "method": "POST",
        "url": "{{ _.base_url }}/api-evc-v1/station/information",
        "body": [{"station_code": "ALL", "action": [{"id": "act-01", "value": "ดึงข้อมูลสถานี"}]}],
        "sort": 1
    },
    {
        "id": "req_stn_add",
        "parent": "fld_station_main",
        "name": "เพิ่มข้อมูล – สถานี",
        "method": "PUT",
        "url": "{{ _.base_url }}/api-evc-v1/station/information",
        "body": [{"station_name": "สถานีหลัก 01", "action": [{"id": "act-02", "value": "เพิ่มสถานี"}]}],
        "sort": 2
    },
    {
        "id": "req_stn_set",
        "parent": "fld_station_main",
        "name": "แก้ไขข้อมูล – สถานี",
        "method": "PATCH",
        "url": "{{ _.base_url }}/api-evc-v1/station/information?station_code=stn-001",
        "body": [{"station_name": "สถานีหลัก 01 (แก้ไข)", "action": [{"id": "act-03", "value": "แก้ไขสถานี"}]}],
        "sort": 3
    },
    {
        "id": "req_stn_del",
        "parent": "fld_station_main",
        "name": "ลบข้อมูล – สถานี",
        "method": "DELETE",
        "url": "{{ _.base_url }}/api-evc-v1/station/information",
        "body": [{"station_code": ["stn-001"], "action": [{"id": "act-04", "value": "ลบสถานี"}]}],
        "sort": 4
    },

    # --- 2. Station Charger Connector ---
    {
        "id": "req_stn_chg_get",
        "parent": "fld_station_charger_main",
        "name": "ดึงข้อมูล – สถานีที่สำหรับจ่ายไฟ",
        "method": "POST",
        "url": "{{ _.base_url }}/api-evc-v1/station-charger/station-charger",
        "body": [{"search": "", "action": [{"id": "act-01", "value": "ดึงข้อมูลสถานีที่สำหรับจ่ายไฟ"}]}],
        "sort": 1
    },
    {
        "id": "req_stn_chg_add",
        "parent": "fld_station_charger_main",
        "name": "เพิ่มข้อมูล – สถานีที่สำหรับจ่ายไฟ",
        "method": "PUT",
        "url": "{{ _.base_url }}/api-evc-v1/station-charger/station-charger",
        "body": [{"station_code": "stn-001", "charger_code": "chg-001", "action": [{"id": "act-02", "value": "ผูกสถานีกับตู้ชาร์จ"}]}],
        "sort": 2
    },
    {
        "id": "req_stn_chg_set",
        "parent": "fld_station_charger_main",
        "name": "แก้ไขข้อมูล – สถานีที่สำหรับจ่ายไฟ",
        "method": "PATCH",
        "url": "{{ _.base_url }}/api-evc-v1/station-charger/station-charger?id=sc-001",
        "body": [{"station_code": "stn-001", "charger_code": "chg-002", "action": [{"id": "act-03", "value": "แก้ไขสถานีกับตู้ชาร์จ"}]}],
        "sort": 3
    },
    {
        "id": "req_stn_chg_del",
        "parent": "fld_station_charger_main",
        "name": "ลบข้อมูล – สถานีที่สำหรับจ่ายไฟ",
        "method": "DELETE",
        "url": "{{ _.base_url }}/api-evc-v1/station-charger/station-charger",
        "body": [{"id": ["sc-001"], "action": [{"id": "act-04", "value": "ลบสถานีกับตู้ชาร์จ"}]}],
        "sort": 4
    },

    # --- 3. Charger ---
    {
        "id": "req_chg_get",
        "parent": "fld_charger_main",
        "name": "ดึงข้อมูล – ตู้ชาร์จ",
        "method": "POST",
        "url": "{{ _.base_url }}/api-evc-v1/charger/information",
        "body": [{"charger_code": "ALL", "action": [{"id": "act-01", "value": "ดึงข้อมูลตู้ชาร์จ"}]}],
        "sort": 1
    },
    {
        "id": "req_chg_add",
        "parent": "fld_charger_main",
        "name": "เพิ่มข้อมูล – ตู้ชาร์จ",
        "method": "PUT",
        "url": "{{ _.base_url }}/api-evc-v1/charger/information",
        "body": [{"charger_name": "ตู้ชาร์จ DC 120kW", "station_code": "stn-001", "action": [{"id": "act-02", "value": "เพิ่มตู้ชาร์จ"}]}],
        "sort": 2
    },
    {
        "id": "req_chg_set",
        "parent": "fld_charger_main",
        "name": "แก้ไขข้อมูล – ตู้ชาร์จ",
        "method": "PATCH",
        "url": "{{ _.base_url }}/api-evc-v1/charger/information?charger_code=chg-001",
        "body": [{"charger_name": "ตู้ชาร์จ DC 120kW (แก้ไข)", "max_total_power_kw": 120, "action": [{"id": "act-03", "value": "แก้ไขตู้ชาร์จ"}]}],
        "sort": 3
    },
    {
        "id": "req_chg_del",
        "parent": "fld_charger_main",
        "name": "ลบข้อมูล – ตู้ชาร์จ",
        "method": "DELETE",
        "url": "{{ _.base_url }}/api-evc-v1/charger/information",
        "body": [{"charger_code": ["chg-001"], "action": [{"id": "act-04", "value": "ลบตู้ชาร์จ"}]}],
        "sort": 4
    },

    # --- 4. Connector ---
    {
        "id": "req_con_get",
        "parent": "fld_connector_main",
        "name": "ดึงข้อมูล – หัวชาร์จ",
        "method": "POST",
        "url": "{{ _.base_url }}/api-evc-v1/connector/get-connector",
        "body": [{"connector_code": "ALL", "action": [{"id": "act-01", "value": "ดึงข้อมูลหัวชาร์จ"}]}],
        "sort": 1
    },
    {
        "id": "req_con_add",
        "parent": "fld_connector_main",
        "name": "เพิ่มข้อมูล – หัวชาร์จ",
        "method": "PUT",
        "url": "{{ _.base_url }}/api-evc-v1/connector/add-connector",
        "body": [{"connector_name": "CCS2 #1", "connector_type": "CCS2", "power_type": "DC", "max_connector_power_kw": 120, "action": [{"id": "act-02", "value": "เพิ่มหัวชาร์จ"}]}],
        "sort": 2
    },
    {
        "id": "req_con_set",
        "parent": "fld_connector_main",
        "name": "แก้ไขข้อมูล – หัวชาร์จ",
        "method": "PATCH",
        "url": "{{ _.base_url }}/api-evc-v1/connector/set-connector?connector_code=con-001",
        "body": [{"connector_name": "CCS2 #1 (แก้ไข)", "action": [{"id": "act-03", "value": "แก้ไขหัวชาร์จ"}]}],
        "sort": 3
    },
    {
        "id": "req_con_del",
        "parent": "fld_connector_main",
        "name": "ลบข้อมูล – หัวชาร์จ",
        "method": "DELETE",
        "url": "{{ _.base_url }}/api-evc-v1/connector/remove-connector",
        "body": [{"connector_code": ["con-001"], "action": [{"id": "act-04", "value": "ลบหัวชาร์จ"}]}],
        "sort": 4
    },

    # --- 5. Authority ---
    {
        "id": "req_aut_get",
        "parent": "fld_authority_main",
        "name": "ดึงข้อมูล – สิทธิ์การใช้งาน",
        "method": "POST",
        "url": "{{ _.base_url }}/api-evc-v1/authority/information",
        "body": [{"authority_code": "ALL", "action": [{"id": "act-01", "value": "ดึงข้อมูลสิทธิ์การใช้งาน"}]}],
        "sort": 1
    },
    {
        "id": "req_aut_add",
        "parent": "fld_authority_main",
        "name": "เพิ่มข้อมูล – สิทธิ์การใช้งาน",
        "method": "PUT",
        "url": "{{ _.base_url }}/api-evc-v1/authority/information",
        "body": [{"authority_name": "Admin", "action": [{"id": "act-02", "value": "เพิ่มสิทธิ์การใช้งาน"}]}],
        "sort": 2
    },
    {
        "id": "req_aut_set",
        "parent": "fld_authority_main",
        "name": "แก้ไขข้อมูล – สิทธิ์การใช้งาน",
        "method": "PATCH",
        "url": "{{ _.base_url }}/api-evc-v1/authority/information?authority_code=aut-001",
        "body": [{"authority_name": "Super Admin", "action": [{"id": "act-03", "value": "แก้ไขสิทธิ์การใช้งาน"}]}],
        "sort": 3
    },
    {
        "id": "req_aut_del",
        "parent": "fld_authority_main",
        "name": "ลบข้อมูล – สิทธิ์การใช้งาน",
        "method": "DELETE",
        "url": "{{ _.base_url }}/api-evc-v1/authority/information",
        "body": [{"authority_code": ["aut-001"], "action": [{"id": "act-04", "value": "ลบสิทธิ์การใช้งาน"}]}],
        "sort": 4
    },

    # --- 6. Users ---
    {
        "id": "req_usr_get",
        "parent": "fld_users_main",
        "name": "ดึงข้อมูล – ผู้ใช้งาน",
        "method": "POST",
        "url": "{{ _.base_url }}/api-evc-v1/users/information",
        "body": [{"user_code": "ALL", "action": [{"id": "act-01", "value": "ดึงข้อมูลผู้ใช้งาน"}]}],
        "sort": 1
    },
    {
        "id": "req_usr_add",
        "parent": "fld_users_main",
        "name": "เพิ่มข้อมูล – ผู้ใช้งาน",
        "method": "PUT",
        "url": "{{ _.base_url }}/api-evc-v1/users/information",
        "body": [
            {
                "user_name": "somchai",
                "user_password": "password123",
                "name": "สมชาย",
                "lastname": "ใจดี",
                "email": "somchai@example.com",
                "action": [{"id": "act-02", "value": "เพิ่มผู้ใช้งาน"}]
            }
        ],
        "sort": 2
    },
    {
        "id": "req_usr_set",
        "parent": "fld_users_main",
        "name": "แก้ไขข้อมูล – ผู้ใช้งาน",
        "method": "PATCH",
        "url": "{{ _.base_url }}/api-evc-v1/users/information?user_code=usr-001",
        "body": [
            {
                "name": "สมชาย (แก้ไข)",
                "lastname": "ใจดีมาก",
                "action": [{"id": "act-03", "value": "แก้ไขผู้ใช้งาน"}]
            }
        ],
        "sort": 3
    },
    {
        "id": "req_usr_del",
        "parent": "fld_users_main",
        "name": "ลบข้อมูล – ผู้ใช้งาน",
        "method": "DELETE",
        "url": "{{ _.base_url }}/api-evc-v1/users/information",
        "body": [{"user_code": ["usr-001"], "action": [{"id": "act-04", "value": "ลบผู้ใช้งาน"}]}],
        "sort": 4
    },

    # --- 7. Vehicle ---
    # --- Vehicle Info ---
    {
        "id": "req_veh_info_get",
        "parent": "fld_vehicle_info",
        "name": "ดึงข้อมูล – รถ",
        "method": "POST",
        "url": "{{ _.base_url }}/api-evc-v1/vehicle/information",
        "body": [{"vehicle_code": "ALL", "search": "", "page_index": 1, "page_limit": 10, "action": [{"id": "act-01", "value": "ดึงข้อมูลรถยนต์"}]}],
        "sort": 1
    },
    {
        "id": "req_veh_info_add",
        "parent": "fld_vehicle_info",
        "name": "เพิ่มข้อมูล – รถ",
        "method": "PUT",
        "url": "{{ _.base_url }}/api-evc-v1/vehicle/information",
        "body": [{"vehicle_name": "Tesla Model 3 Performance", "vehicle_license": "กก 1234", "model_code": "mdl-20260730000001", "battery_capacity_kwh": 78.1, "max_ac_charge_rate_kw": 11, "max_dc_charge_rate_kw": 250, "supported_connectors": ["Type 2", "CCS2"], "action": [{"id": "act-02", "value": "เพิ่มรถยนต์"}]}],
        "sort": 2
    },
    {
        "id": "req_veh_info_set",
        "parent": "fld_vehicle_info",
        "name": "แก้ไขข้อมูล – รถ",
        "method": "PATCH",
        "url": "{{ _.base_url }}/api-evc-v1/vehicle/information?vehicle_code=veh-20260730000001",
        "body": [{"vehicle_name": "Tesla Model 3 Long Range", "vehicle_license": "ขข 5678", "battery_capacity_kwh": 82, "action": [{"id": "act-03", "value": "แก้ไขรถยนต์"}]}],
        "sort": 3
    },
    {
        "id": "req_veh_info_del",
        "parent": "fld_vehicle_info",
        "name": "ลบข้อมูล – รถ",
        "method": "DELETE",
        "url": "{{ _.base_url }}/api-evc-v1/vehicle/information",
        "body": [{"vehicle_code": ["veh-20260730000001"], "action": [{"id": "act-04", "value": "ลบรถยนต์"}]}],
        "sort": 4
    },
    # --- Vehicle Brand ---
    {
        "id": "req_veh_brand_get",
        "parent": "fld_vehicle_brand",
        "name": "ดึงข้อมูล – แบรนด์รถ",
        "method": "POST",
        "url": "{{ _.base_url }}/api-evc-v1/vehicle/brand",
        "body": [{"brand_code": "ALL", "search": "", "page_index": 1, "page_limit": 10, "action": [{"id": "act-01", "value": "ดึงข้อมูลแบรนด์รถ"}]}],
        "sort": 1
    },
    {
        "id": "req_veh_brand_add",
        "parent": "fld_vehicle_brand",
        "name": "เพิ่มข้อมูล – แบรนด์รถ",
        "method": "PUT",
        "url": "{{ _.base_url }}/api-evc-v1/vehicle/brand",
        "body": [{"brand_name": "Tesla", "action": [{"id": "act-02", "value": "เพิ่มแบรนด์รถ"}]}],
        "sort": 2
    },
    {
        "id": "req_veh_brand_set",
        "parent": "fld_vehicle_brand",
        "name": "แก้ไขข้อมูล – แบรนด์รถ",
        "method": "PATCH",
        "url": "{{ _.base_url }}/api-evc-v1/vehicle/brand?brand_code=brd-20260730000001",
        "body": [{"brand_name": "Tesla Motors", "action": [{"id": "act-03", "value": "แก้ไขแบรนด์รถ"}]}],
        "sort": 3
    },
    {
        "id": "req_veh_brand_del",
        "parent": "fld_vehicle_brand",
        "name": "ลบข้อมูล – แบรนด์รถ",
        "method": "DELETE",
        "url": "{{ _.base_url }}/api-evc-v1/vehicle/brand",
        "body": [{"brand_code": ["brd-20260730000001"], "action": [{"id": "act-04", "value": "ลบแบรนด์รถ"}]}],
        "sort": 4
    },
    # --- Vehicle Model ---
    {
        "id": "req_veh_model_get",
        "parent": "fld_vehicle_model",
        "name": "ดึงข้อมูล – โมเดลรถ",
        "method": "POST",
        "url": "{{ _.base_url }}/api-evc-v1/vehicle/model",
        "body": [{"model_code": "ALL", "search": "", "page_index": 1, "page_limit": 10, "action": [{"id": "act-01", "value": "ดึงข้อมูลโมเดลรถ"}]}],
        "sort": 1
    },
    {
        "id": "req_veh_model_add",
        "parent": "fld_vehicle_model",
        "name": "เพิ่มข้อมูล – โมเดลรถ",
        "method": "PUT",
        "url": "{{ _.base_url }}/api-evc-v1/vehicle/model",
        "body": [{"brand_code": "brd-20260730000001", "model_name": "Model Y", "action": [{"id": "act-02", "value": "เพิ่มโมเดลรถ"}]}],
        "sort": 2
    },
    {
        "id": "req_veh_model_set",
        "parent": "fld_vehicle_model",
        "name": "แก้ไขข้อมูล – โมเดลรถ",
        "method": "PATCH",
        "url": "{{ _.base_url }}/api-evc-v1/vehicle/model?model_code=mdl-20260730000001",
        "body": [{"brand_code": "brd-20260730000001", "model_name": "Model Y Long Range", "action": [{"id": "act-03", "value": "แก้ไขโมเดลรถ"}]}],
        "sort": 3
    },
    {
        "id": "req_veh_model_del",
        "parent": "fld_vehicle_model",
        "name": "ลบข้อมูล – โมเดลรถ",
        "method": "DELETE",
        "url": "{{ _.base_url }}/api-evc-v1/vehicle/model",
        "body": [{"model_code": ["mdl-20260730000001"], "action": [{"id": "act-04", "value": "ลบโมเดลรถ"}]}],
        "sort": 4
    },
    # --- Vehicle Type ---
    {
        "id": "req_veh_type_get",
        "parent": "fld_vehicle_type",
        "name": "ดึงข้อมูล – ประเภทรถ",
        "method": "POST",
        "url": "{{ _.base_url }}/api-evc-v1/vehicle/type",
        "body": [{"veh_type_code": "ALL", "search": "", "page_index": 1, "page_limit": 10, "action": [{"id": "act-01", "value": "ดึงข้อมูลประเภทรถ"}]}],
        "sort": 1
    },
    {
        "id": "req_veh_type_add",
        "parent": "fld_vehicle_type",
        "name": "เพิ่มข้อมูล – ประเภทรถ",
        "method": "PUT",
        "url": "{{ _.base_url }}/api-evc-v1/vehicle/type",
        "body": [{"veh_type_name": "รถยนต์นั่งส่วนบุคคล EV", "width": 1.85, "height": 1.45, "length": 4.7, "speed_limit": 120, "passenger_limit": 5, "action": [{"id": "act-02", "value": "เพิ่มประเภทรถ"}]}],
        "sort": 2
    },
    {
        "id": "req_veh_type_set",
        "parent": "fld_vehicle_type",
        "name": "แก้ไขข้อมูล – ประเภทรถ",
        "method": "PATCH",
        "url": "{{ _.base_url }}/api-evc-v1/vehicle/type?veh_type_code=typ-20260730000001",
        "body": [{"veh_type_name": "รถยนต์นั่งส่วนบุคคล EV High Speed", "action": [{"id": "act-03", "value": "แก้ไขประเภทรถ"}]}],
        "sort": 3
    },
    {
        "id": "req_veh_type_del",
        "parent": "fld_vehicle_type",
        "name": "ลบข้อมูล – ประเภทรถ",
        "method": "DELETE",
        "url": "{{ _.base_url }}/api-evc-v1/vehicle/type",
        "body": [{"veh_type_code": ["typ-20260730000001"], "action": [{"id": "act-04", "value": "ลบประเภทรถ"}]}],
        "sort": 4
    },

    # --- 8. Reservation ---
    {
        "id": "req_res_get",
        "parent": "fld_reservation_main",
        "name": "ดึงข้อมูล – การจอง",
        "method": "POST",
        "url": "{{ _.base_url }}/api-evc-v1/reservation/information",
        "body": [{"reservation_code": "ALL", "action": [{"id": "act-01", "value": "ดึงข้อมูลการจอง"}]}],
        "sort": 1
    },
    {
        "id": "req_res_add",
        "parent": "fld_reservation_main",
        "name": "เพิ่มข้อมูล – การจอง",
        "method": "PUT",
        "url": "{{ _.base_url }}/api-evc-v1/reservation/information",
        "body": [{"connector_code": "con-001", "vehicle_code": "veh-001", "action": [{"id": "act-02", "value": "จองคิวชาร์จ"}]}],
        "sort": 2
    },
    {
        "id": "req_res_set",
        "parent": "fld_reservation_main",
        "name": "แก้ไขข้อมูล – การจอง",
        "method": "PATCH",
        "url": "{{ _.base_url }}/api-evc-v1/reservation/information?reservation_code=res-001",
        "body": [{"reservation_status": "CANCELLED", "action": [{"id": "act-03", "value": "ยกเลิกการจอง"}]}],
        "sort": 3
    },
    {
        "id": "req_res_del",
        "parent": "fld_reservation_main",
        "name": "ลบข้อมูล – การจอง",
        "method": "DELETE",
        "url": "{{ _.base_url }}/api-evc-v1/reservation/information",
        "body": [{"reservation_code": ["res-001"], "action": [{"id": "act-04", "value": "ลบการจอง"}]}],
        "sort": 4
    },
    {
        "id": "req_res_start",
        "parent": "fld_reservation_main",
        "name": "เริ่มการชาร์จ – Start Charging",
        "method": "POST",
        "url": "{{ _.base_url }}/api-evc-v1/reservation/start",
        "body": [{"reservation_code": "res-001", "action": [{"id": "act-05", "value": "เริ่มชาร์จ"}]}],
        "sort": 5
    },
    {
        "id": "req_res_end",
        "parent": "fld_reservation_main",
        "name": "สิ้นสุดการชาร์จ – End Charging",
        "method": "POST",
        "url": "{{ _.base_url }}/api-evc-v1/reservation/end",
        "body": [{"reservation_code": "res-001", "energy_delivered_kwh": 45.5, "action": [{"id": "act-06", "value": "จบชาร์จ"}]}],
        "sort": 6
    },

    # --- 9. Auth ---
    {
        "id": "req_auth_get",
        "parent": "fld_auth_main",
        "name": "เข้าสู่ระบบ",
        "method": "POST",
        "url": "{{ _.base_url }}/api-evc-v1/auth/information",
        "body": [{"user_name": "somchai", "user_password": "password123", "action": [{"id": "act-01", "value": "เข้าสู่ระบบ"}]}],
        "sort": 1
    },
    {
        "id": "req_auth_reset",
        "parent": "fld_auth_main",
        "name": "เปลี่ยนรหัสผ่าน",
        "method": "PATCH",
        "url": "{{ _.base_url }}/api-evc-v1/auth/reset/information",
        "body": [{"user_code": "usr-001", "new_password": "newpassword123", "action": [{"id": "act-02", "value": "เปลี่ยนรหัสผ่าน"}]}],
        "sort": 2
    }
]

for r in requests:
    resources.append({
        "_id": r["id"],
        "_type": "request",
        "parentId": r["parent"],
        "modified": now_ms,
        "created": now_ms,
        "url": r["url"],
        "name": r["name"],
        "description": "",
        "method": r["method"],
        "body": {
            "mimeType": "application/json",
            "text": json.dumps(r["body"], ensure_ascii=False, indent=2)
        },
        "parameters": [],
        "headers": headers_default,
        "authentication": {},  # Inherits auth from parent folder
        "metaSortKey": r["sort"],
        "isPrivate": False,
        "settingStoreCookies": True,
        "settingSendCookies": True,
        "settingDisableRenderRequestBody": False,
        "settingEncodeUrl": True,
        "settingRebuildPath": True,
        "settingFollowRedirects": "global"
    })

collection = {
    "_type": "export",
    "__export_format": 4,
    "__export_date": "2026-07-30T10:56:00.000Z",
    "__export_source": "insomnia.desktop.app:v2023.5.8",
    "resources": resources
}

with open("/Users/tanachai_ho/Desktop/Coding/ev-charging/insomnia_collection.json", "w", encoding="utf-8") as f:
    json.dump(collection, f, ensure_ascii=False, indent=2)

print("Full Insomnia Collection Generated Successfully!")
