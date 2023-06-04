// import {DataTypes, InferAttributes, InferCreationAttributes, Model} from "sequelize";
// import sequelize from "./db";
//
// class AircraftData extends Model<InferAttributes<AircraftData>, InferCreationAttributes<AircraftData>>{
//     declare aircraft_code:
// }
//
// const aircraft_data = sequelize.define('aircrafts_data', {
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
//
// const airports_data = sequelize.define('airports_data', {
//     airport_code:{
//         type: DataTypes.CHAR(3),
//         allowNull: false,
//         primaryKey: true
//     },
//     airport_name:{
//         type: DataTypes.JSONB,
//         allowNull: false
//     },
//     city:{
//         type: DataTypes.JSONB,
//         allowNull: false
//     },
//     coordinates: {
//         type: DataTypes.GEOMETRY('POINT'),
//         allowNull: false
//     },
//     timezone: {
//         type: DataTypes.TEXT,
//         allowNull: false
//     }
// }, {timestamps: false})
//
// export {
//     aircraft_data,
//     airports_data
// }
