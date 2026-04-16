const prod = false;

const connectionStringOnProd = {
  user: "postgres",
  password: "reP@ssw0rd778900",
  host: "203.150.210.25",
  port: 5432,
  database: "tms_aos01"
}

const connectionStringOnSit = {
  user: "postgres",
  password: "reP@ssw0rd778900",
  host: "203.150.210.25",
  port: 5432,
  database: "tms_aos01"
}

exports.connectionString = () => {
  return (prod == true) ? connectionStringOnProd : connectionStringOnSit;
}

exports.authWebsite = () => {
  return `Basic dG1zdjIud2Vic2l0ZTpyZVBAc3N3MHJkNzc4OTAw`;
}

exports.authMobile = () => {
  return `Basic dG1zdjIubW9iaWxlOnJlUEBzc3cwcmQ3Nzg5MDA=`;
}

exports.dbPrefix = () => {
  return `tms_`;
}