"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = exports.sequelize = void 0;
const express_1 = __importDefault(require("express"));
// import {Sequelize as SequelizeType} from "sequelize/types/sequelize";
const sequelize_1 = require("sequelize");
const general_1 = __importDefault(require("./routes/general"));
const airports_1 = __importDefault(require("./routes/airports"));
const routes_1 = __importDefault(require("./routes/routes"));
const swaggerUi = require('swagger-ui-express');
const swaggerJSON = require('./swagger_output.json');
const app = (0, express_1.default)();
exports.app = app;
const port = 3000;
const sequelize = new sequelize_1.Sequelize('demo', 'postgres', 'postgres', {
    host: 'localhost',
    dialect: 'postgres'
});
exports.sequelize = sequelize;
sequelize.authenticate().then((_) => {
    console.log('Connection has been established successfully.');
}).catch((error) => {
    console.error('Unable to connect to the database:', error);
});
exports.default = () => {
    app.use('/doc', swaggerUi.serve, swaggerUi.setup(swaggerJSON));
    app.use('/', general_1.default);
    app.use('/airports', airports_1.default);
    app.use('/routes', routes_1.default);
    app.listen(port, () => {
        console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
    });
};
