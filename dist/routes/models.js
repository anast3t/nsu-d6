"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.airports_data = exports.aircraft_data = void 0;
const sequelize = await require('../initExpress');
console.log("Sequelize:", sequelize);
setTimeout(() => {
    console.log(sequelize);
}, 2000);
const aircraft_data = {};
exports.aircraft_data = aircraft_data;
// sequelize.define('aircrafts_data', {
//     aircraft_code:{
//         type: DataTypes.CHAR(3),
//         allowNull: false,
//         primaryKey: true
//     },
//     model:{
//         type: DataTypes.JSONB,
//         allowNull: false
//     },
//     range:{
//         type: DataTypes.INTEGER,
//         allowNull: false
//     }
// }, {timestamps: false})
const airports_data = {};
exports.airports_data = airports_data;
