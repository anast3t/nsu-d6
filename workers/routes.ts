import {getLang} from "../initExpress";
import {pool} from "../db";
let parse = require('date-fns/parse')
let compareAsc = require('date-fns/compareAsc')
let add = require('date-fns/add')

const { parentPort, workerData } = require("node:worker_threads")

function time2Date(departure: string, arrival: string){
    let date = new Date()

    let departureStamp = parse(departure, "HH:mm:ss", date)
    let arrivalStamp = parse(arrival, "HH:mm:ss", date)

    if(compareAsc(departureStamp, arrivalStamp) == 1){
        arrivalStamp = add(arrivalStamp, {days: 1})
    }
    return [departureStamp, arrivalStamp]
}
type Fare = 'Economy' | 'Business' | 'Comfort'
type Flight = {
    flight_no: string,
    aircraft_code: string,
    days_of_week: number[],
    departure: Date|string,
    departure_utc: string
    arrival: Date|string,
    arrival_utc: string
    arrival_airport: string,
    departure_airport: string,
    fare_conditions: Fare[],
    arrival_city: {en: string, ru: string},
    departure_city: {en: string, ru: string},
    price: string
}

let req = workerData
console.log("IM IN")
const pointA = req.query.point_a as string;
const pointB = req.query.point_b as string;
const departureDate = req.query.departure_date as string;
const bookingClass = req.query.booking_class as Fare;
const connections = parseInt(req.query.connections as string);
const ddsplitted = departureDate.split('.').map((val)=>parseInt(val))
const dow = (new Date(ddsplitted[2], ddsplitted[1], ddsplitted[0])).getUTCDay()

// const queryAll = {
//     name: 'initial-search-routes',
//     text: `select * from schedule
//            where $1 = ANY(fare_conditions) and
//            $2 = ANY(days_of_week) and arrival_airport != $3 and $3 != arrival_city->>'${getLang()}'`,
//     values: [bookingClass, dow, pointA]
// }

//INFO: сразу отсеиваются маршруты, у которых нет цены. Соответственно на выходе будет меньше.
const queryAll = {
    name: 'initial-search-routes',
    text: ` select sch.flight_no,
                       aircraft_code,
                       days_of_week,
                       departure,
                       arrival,
                       arrival_airport,
                       departure_airport,
                       fare_conditions,
                       sch.arrival_city,
                       sch.departure_city,
                       price
                from schedule as sch
                         inner join (select flight_no, min(amount) as price
                                     from prices
                                     where fare_conditions = $1
                                     group by flight_no, fare_conditions) as p on sch.flight_no = p.flight_no
                where $1 = ANY (sch.fare_conditions)
                  and $2 = ANY (days_of_week)
                  and arrival_airport != $3 and $3 != arrival_city->>'${getLang()}'`,
    values: [bookingClass, dow, pointA]
}
let results:Flight[] = [];
// try {
(async () => {
    results = ((await pool.query(queryAll)).rows)
    results.forEach(el=>{
        el.arrival_utc = el.arrival as string
        el.departure_utc = el.departure as string
        [el.departure, el.arrival] = time2Date(el.departure as string, el.arrival as string)
    })
// } catch(err){
//     res.statusCode = 500
//     res.json(err)
//     return
// }

    function getConnections(chain: Flight[]){
        const last: Flight = chain[chain.length-1]
        // @ts-ignore
        if(last.arrival_airport == pointB || last.arrival_city[getLang()] == pointB){
            return chain
        }
        const previousDep = chain.map(el => el.departure_airport)
        const previousArrive = chain.map(el => el.arrival_airport)
        const available = results.filter((el)=>{
            return (el.departure > last.arrival) &&
                (el.departure_airport == last.arrival_airport) &&
                (!previousArrive.includes(el.arrival_airport)) &&
                (!previousDep.includes(el.arrival_airport))
        })
        if(available.length == 0)
            throw new Error("no els")
        else{
            let chains: any[] = []
            available.forEach(el=>{

                let nextChain = chain.concat([el])
                // @ts-ignore
                if(el.arrival_airport == pointB || el.arrival_city[getLang()] == pointB ){
                    chains.push(nextChain)
                } else {
                    if(nextChain.length == connections+1)
                        throw new Error("Limit of connections")
                    try {
                        chains.push(getConnections(nextChain))
                    } catch (e){

                    }
                }
            })
            if(chains.length == 0)
                throw new Error("no chains found")
            return chains;
        }
    }

    const firstChain = results.filter((el) => {
        // @ts-ignore
        return el.departure_airport == pointA || el.departure_city[getLang()] == pointA
    })

    let chains: any[] = []
    firstChain.forEach(el => {
        try{
            chains.push(getConnections([el]))
        } catch(e){

        }
    })
    function recFlat(arr: any[]){
        for (let idx = 0; idx < arr.length; idx++){
            const el = arr[idx];
            if(Array.isArray(el) && Array.isArray(el[0]) && Array.isArray(el[0][0])){
                arr[idx] = el.flat()
                idx = 0
            }
        }
    }

    recFlat(chains)
    chains = chains.flat().sort((a, b): number =>{
        if(!Array.isArray(a) && !Array.isArray(b))
            return 0
        if(!Array.isArray(a))
            return -1
        if(!Array.isArray(b))
            return 1
        if(a.length > b.length)
            return 1
        else if (a.length == b.length)
            return 0
        else return -1
    })

// INFO: регрупнул и стандартизировал вывод, добавил цену
    let ids = chains.map((el)=>{
        if(Array.isArray(el)){
            let res:{
                price:number,
                chain:string[]
            } = {
                price: 0,
                chain: []
            }
            el.forEach((el1:Flight):void => {
                res.chain.push(el1.flight_no)
                res.price += parseFloat(el1.price)
            })
            return res
        } else {
            return {chain: [el.flight_no], price: parseFloat(el.price)}
        }
    })

    let flights = chains.flat()
    let uniqueFlights = [...new Set(flights)]
    let uniqueAirports = [...new Set(
        uniqueFlights.map(el => {
            return [el.departure_airport, el.arrival_airport]
        }).flat()
    )]

    for(let i = 0; i < uniqueAirports.length; i++){
        const query = {
            name: 'fetch-airports',
            text: `
            select 
                airport_name->>'${getLang()}' as name, 
                airport_code as code, 
                coordinates, 
                timezone 
            from airports_data where airport_code = $1`,
            values: [uniqueAirports[i]]
        }
        // try{
        let airport = (await pool.query(query)).rows[0]
        airport.coordinates.lat = airport.coordinates.x
        airport.coordinates.lng = airport.coordinates.y
        delete airport.coordinates.x
        delete airport.coordinates.y
        uniqueAirports[i] = airport

        // } catch (err) {
        //     throw new Error()
        //     // res.statusCode = 500
        //     // res.json(err)
        // }
    }

    let send = {
        chains:ids,
        flights:uniqueFlights,
        airports: uniqueAirports
    }

    parentPort?.postMessage(send)
})()

