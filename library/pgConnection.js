const {
    Pool
} = require('pg')
var pool;
exports.link = async (connectionstring) => {
    let temporary = JSON.parse(JSON.stringify(connectionstring));
    pool = new Pool(temporary)
}

exports.execute2params = async (script, params = []) => {

    try {
        const client = await pool.connect()
        try {
            const res = await client.query(script, params)

            console.log("execute action: " + res.rowCount + " row(s)")

            return {
                code: false,
                rowaction: res.rowCount,
                rows: res.rows
            }

        } catch (e) {
            console.log('error code : ' + e.code + ' err.message : ' + e.message)

            if (e.code == '23505' || e.code == '42P04') {
                return {
                    code: false,
                    rowaction: 0
                }
            } else {
                return {
                    code: true,
                    message: e.message
                }
            }

        } finally {
            client.release()
        }

    } catch (error) {
        return {
            code: true,
            message: error.message
        }
    }
}

exports.execute = async (dbname, script, connectionstring) => {
    //execute data
    //debugger;
    let temporary = JSON.parse(JSON.stringify(connectionstring))
    if (dbname != null) {
        temporary.database = dbname
    }
    try {
        var pool = new Pool(temporary)
        const client = await pool.connect()
        try {
            const res = await client.query(script)

            if (res.rowCount != undefined) {
                console.log("execute action: " + res.rowCount + " row(s)");
            }
            else {
                console.log("execute action: complete.");
            }

            return {
                code: false,
                rowaction: res.rowCount
            }

        } catch (e) {
            console.log(script + ' : error code : ' + e.code + ' err.message : ' + e.message)

            if (e.code == '23505' || e.code == '42P04') {
                return {
                    code: false,
                    rowaction: 0
                }
            }
            else {
                return {
                    code: true,
                    message: e.message
                }
            }



        } finally {
            client.release()
        }
    } catch (error) {
        console.log(script + ' : error code : ' + error.code + ' err.message : ' + error.message)
        return {
            code: true,
            message: error.message
        }
    }
}

exports.get = async (dbname, script, connectionstring) => {
    //get data
    let temporary = JSON.parse(JSON.stringify(connectionstring))
    if (dbname != null) {
        temporary.database = dbname
    }

    try {
        var pool = new Pool(temporary)
        const client = await pool.connect()
        try {
            const res = await client.query(script)
            return { code: false, data: res.rows }

        } catch (e) {

            if (e.code != '3D000') {
                console.log(script + ' : error code : ' + e.code + ' err.message : ' + e.message)
            }

            return {
                code: true,
                message: e.message
            }
        } finally {
            client.release()
        }
    } catch (error) {

        if (error.code != '3D000') {
            console.log(script + ' : error code : ' + e.code + ' err.message : ' + e.message)
        }

        return {
            code: true,
            message: error.message
        }
    }
}

// เพิ่มตัวแปร params เข้ามาในฟังก์ชัน
exports.getWithParams = async (dbname, script, params = [], connectionstring) => {
    // get data
    let temporary = JSON.parse(JSON.stringify(connectionstring))
    if (dbname != null) {
        temporary.database = dbname
    }

    let pool;
    try {
        pool = new Pool(temporary)
        const client = await pool.connect()
        try {
            // ส่ง script คู่กับ params เข้าไปใน client.query
            const res = await client.query(script, params)
            return { code: false, data: res.rows }

        } catch (e) {
            if (e.code != '3D000') {
                console.log(`${script} : error code : ${e.code} err.message : ${e.message}`)
            }
            return { code: true, message: e.message }
        } finally {
            client.release()
            // แนะนำให้จบการทำงานของ pool ถ้าสร้างใหม่ทุกครั้ง (หรือใช้ Global Pool แทนจะดีกว่า)
            await pool.end()
        }
    } catch (error) {
        if (error.code != '3D000') {
            // แก้ไขตัวแปรจาก e เป็น error เพื่อให้ตรงกับ catch
            console.log(`${script} : error code : ${error.code} err.message : ${error.message}`)
        }
        return { code: true, message: error.message }
    }
}

exports.upsert = async (dbname, insert, update, connectionString) => {
    // 1 by 1 upsert
    var arr = [];
    var script = '';
    var temp = '';

    try {
        //debugger;
        arr = insert.split('VALUES')

        if (arr[1] == undefined) {
            arr = insert.split('values')
        }

        temp = arr[1].replace(/^\s+|\s+$/g, '');
        arr[1] = temp.substring(1, temp.length - 1);
        insert = arr[0] + " SELECT " + arr[1];

        var script = " WITH upsert AS (" + update + "  RETURNING *)";
        script += " " + insert + " ";
        script += " WHERE NOT EXISTS (SELECT * FROM upsert)";

        let r = await this.execute(dbname, script, connectionString);
        return r;
    } catch (ex) {
        console.log('setUpsertScript : ' + ex)
        return { code: true, message: ex }
    }

};
