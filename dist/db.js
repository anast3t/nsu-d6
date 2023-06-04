"use strict";
// import {DataTypes, Sequelize} from "sequelize";
//
// const sequelize:Sequelize = new Sequelize('demo', 'postgres', 'postgres', {
//     host: 'localhost',
//     dialect: 'postgres'
// });
//
// sequelize.authenticate()
//     .then((res)=>{
//         console.log('Connection has been established successfully.');
//     })
//     .catch((error)=>{
//         console.error('Unable to connect to the database:', error);
//     })
//
// export default sequelize
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const pg_1 = require("pg");
exports.db = new pg_1.Client({
    host: "localhost",
    port: 5432,
    database: "demo",
    user: "postgres",
    password: "postgres"
});
exports.db.connect()
    .then(res => {
    console.log("DB connection successful");
})
    .catch(err => {
    console.error("DB connection refused", err);
});
