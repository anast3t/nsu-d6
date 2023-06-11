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

import {Client, Pool} from 'pg'
// export const db = new Client({
//     host: "localhost",
//     port: 5432,
//     database: "demo",
//     user: "postgres",
//     password: "postgres"
// })
//
// db.connect()
//     .then(res => {
//         console.log("DB connection successful")
//     })
//     .catch(err => {
//         console.error("DB connection refused", err)
//     })

export const pool = new Pool({
    host: "localhost",
    port: 5432,
    database: "demo",
    user: "postgres",
    password: "postgres",
    max: 20
})


