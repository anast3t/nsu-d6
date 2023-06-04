const swaggerAutogen = require('swagger-autogen')({language: 'ru-RU', openapi: '3.0.0'})

const outputFile = './dist/swagger_output.json'
// const endpointsFiles = ['./routes/general.ts', './routes/airports.ts', './routes/routes.ts']
const endpointsFiles = ['./initExpress.ts']
swaggerAutogen(outputFile, endpointsFiles)
