const axios = require('axios');

const sapApiClient = axios.create({
    baseURL: 'https://apiqas-bcp.test01.apimanagement.ap11.hana.ondemand.com:443/v1',
    maxBodyLength: Infinity,
    headers: {
        'APIKey': 'TRtiSlDe7esbl0lWftGvbEJwY8pfsp86',
        'Content-Type': 'application/json'
    }
});

module.exports = { sapApiClient };
