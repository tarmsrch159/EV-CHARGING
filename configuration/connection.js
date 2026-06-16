const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });

const prod = process.env.IS_PROD === 'true';

const connectionStringOnProd = {
  user: process.env.DB_USER_PROD || "postgres",
  password: process.env.DB_PASSWORD_PROD || "$!Zy2tTP^3",
  host: process.env.DB_HOST_PROD || "10.100.1.103",
  port: parseInt(process.env.DB_PORT_PROD || "5432", 10),
  database: process.env.DB_DATABASE_PROD || "tms_aos_qa"
}

const connectionStringOnSit = {
  user: process.env.DB_USER_SIT || "postgres",
  password: process.env.DB_PASSWORD_SIT || "reP@ssw0rd778900",
  host: process.env.DB_HOST_SIT || "203.150.210.25",
  port: parseInt(process.env.DB_PORT_SIT || "5432", 10),
  database: process.env.DB_DATABASE_SIT || "tms_aos01"
}

exports.connectionString = (dbdatabase) => {
  if (process.env.DB_HOST) {
    return {
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "reP@ssw0rd778900",
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || "5432", 10),
      database: dbdatabase || process.env.DB_DATABASE || "tms_aos01"
    };
  }

  const baseConfig = (prod === true) ? connectionStringOnProd : connectionStringOnSit;
  if (dbdatabase) {
    return {
      ...baseConfig,
      database: dbdatabase
    };
  }
  return baseConfig;
}

exports.authWebsite = () => {
  return process.env.AUTH_WEBSITE || `Basic dG1zdjIud2Vic2l0ZTpyZVBAc3N3MHJkNzc4OTAw`;
}

exports.authMobile = () => {
  return process.env.AUTH_MOBILE || `Basic dG1zdjIubW9iaWxlOnJlUEBzc3cwcmQ3Nzg5MDA=`;
}

exports.dbPrefix = () => {
  return process.env.DB_PREFIX || `tms_`;
}