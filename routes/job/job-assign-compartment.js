
const config = require('../../configuration/connection');
const pgConn = require('../../library/pgConnection');
const moment = require('moment');
const xglobal = require('../../middleware/global');

const dbPrefix = config.dbPrefix();

/**
 * Rounds a number down to the nearest 1000.
 * */
function roundDown1000(x) {
    return Math.floor(x / 1000) * 1000;
}

/**
 * Compares two Sets for value equality.
 * @param {Set<any>} setA The first set.
 * @param {Set<any>} setB The second set.
 * @returns {boolean} True if the sets contain the exact same elements.
 */
function areSetsEqual(setA, setB) {
    if (setA.size !== setB.size) return false;
    for (const item of setA) {
        if (!setB.has(item)) return false;
    }
    return true;
}

//============================================
// MAIN ASSIGNMENT FUNCTION
//============================================

/**
 * Orchestrates the entire process of assigning products from drop orders to truck compartments.
 * @param {Object<string, number[]>} truckCompartments - Defines the truck. Keys are compartment names, values are arrays of possible volumes.
 * @param {Array<Object>} dropOrders - An array of orders. Each order has an `order_no` and a `products` array,
 * where each product object is `{ product: string, volume: number, tank_no: string }`.
 * @returns {Object} - If successful, returns an object mapping order numbers to their assignments. If failed, returns an error object with suggestions.
 */
function assignTruck(truckCompartments, dropOrders) {
    const numCompartments = Object.keys(truckCompartments).length;
    const truckType = numCompartments === 4 ? "rigid" : numCompartments === 6 ? "semi" : "other";

    // Pre-processing: Deep copy and round all product volumes down.
    const roundedOrders = JSON.parse(JSON.stringify(dropOrders));
    for (const drop of roundedOrders) {
        for (const productInfo of drop.products) {
            productInfo.volume = roundDown1000(productInfo.volume);
        }
    }

    //============================================
    // CORE LOGIC (NESTED FUNCTIONS)
    //============================================

    function isValidDropCombo(comboSet, truckType, r) {
        let valid1 = [],
            valid2 = [],
            valid3 = [];
        if (truckType === "rigid") {
            valid1 = [new Set(["Compartment 1"]), new Set(["Compartment 2"])];
            valid2 = [new Set(["Compartment 1", "Compartment 3"]), new Set(["Compartment 1", "Compartment 4"]), new Set(["Compartment 2", "Compartment 3"])];
        } else if (truckType === "semi") {
            valid1 = [new Set(["Compartment 1"]), new Set(["Compartment 2"]), new Set(["Compartment 3"]), new Set(["Compartment 4"])];
            valid2 = [new Set(["Compartment 1", "Compartment 3"]), new Set(["Compartment 1", "Compartment 4"]), new Set(["Compartment 1", "Compartment 5"]), new Set(["Compartment 2", "Compartment 3"]), new Set(["Compartment 2", "Compartment 4"]), new Set(["Compartment 2", "Compartment 5"]), new Set(["Compartment 3", "Compartment 4"])];
            valid3 = [
                new Set(["Compartment 1", "Compartment 2", "Compartment 4"]),
                new Set(["Compartment 1", "Compartment 2", "Compartment 5"]),
                new Set(["Compartment 1", "Compartment 2", "Compartment 6"]),
                new Set(["Compartment 1", "Compartment 4", "Compartment 5"]),
                new Set(["Compartment 1", "Compartment 3", "Compartment 4"]),
                new Set(["Compartment 2", "Compartment 4", "Compartment 5"]),
            ];
        } else {
            return true;
        }
        if (r === 1 && !valid1.some(s => areSetsEqual(s, comboSet))) return false;
        if (r === 2 && !valid2.some(s => areSetsEqual(s, comboSet))) return false;
        if (r === 3 && truckType === 'semi' && !valid3.some(s => areSetsEqual(s, comboSet))) return false;
        return true;
    }

    function getVolumeCombinations(target, comps) {
        const options = [];
        for (const c of comps) {
            for (const v of truckCompartments[c]) {
                options.push([c, v]);
            }
        }
        const results = [];

        function backtrack(start, combo, used, total) {
            if (total === target) {
                results.push([...combo]);
                return;
            }
            if (total > target) return;
            for (let i = start; i < options.length; i++) {
                const [c, v] = options[i];
                if (used.has(c)) continue;
                used.add(c);
                combo.push([c, v]);
                backtrack(i + 1, combo, used, total + v);
                combo.pop();
                used.delete(c);
            }
        }
        backtrack(0, [], new Set(), 0);
        return results;
    }

    function getAllAssignments(products, availableComps) {
        function recursive(prodList, used, current) {
            if (prodList.length === 0) {
                return [
                    [...current]
                ];
            }
            const {
                product,
                volume,
                tank_no
            } = prodList[0];
            const rest = prodList.slice(1);
            const validCombos = getVolumeCombinations(volume, availableComps.filter(c => !used.has(c)));
            const results = [];
            for (const combo of validCombos) {
                const comboSet = new Set(combo.map(([c, _]) => c));
                const newUsed = new Set([...used, ...comboSet]);
                const newAssignment = current.concat(combo.map(([c, v]) => ({
                    product,
                    compartment: c,
                    volume: v,
                    tank_no
                })));
                const subResults = recursive(rest, newUsed, newAssignment);
                results.push(...subResults);
            }
            return results;
        }
        return recursive(products, new Set(), []);
    }

    function planRecursive(drops, usedComps, path) {
        if (drops.length === 0) return [path];
        const availableComps = Object.keys(truckCompartments).filter(c => !usedComps.has(c));
        const totalRemainingDemandAggregated = {};
        for (const drop of drops) {
            for (const productInfo of drop.products) {
                const {
                    product,
                    volume
                } = productInfo;
                totalRemainingDemandAggregated[product] = (totalRemainingDemandAggregated[product] || 0) + volume;
            }
        }
        if (Object.keys(totalRemainingDemandAggregated).length > 0) {
            const futureProductsList = Object.entries(totalRemainingDemandAggregated).map(([prod, vol]) => ({
                product: prod,
                volume: vol,
                tank_no: 'future_check'
            }));
            const possibleFutureAssignments = getAllAssignments(futureProductsList, availableComps);
            if (possibleFutureAssignments.length === 0) return [];
            let isSafeFuturePossible = false;
            for (const futureAssign of possibleFutureAssignments) {
                const compsForFuture = new Set(futureAssign.map(a => a.compartment));
                const numFutureComps = compsForFuture.size;
                if (numFutureComps > 3 || isValidDropCombo(compsForFuture, truckType, numFutureComps)) {
                    isSafeFuturePossible = true;
                    break;
                }
            }
            if (!isSafeFuturePossible) return [];
        }
        const current = drops[0];
        const rest = drops.slice(1);
        const assignments = getAllAssignments(current.products, availableComps);
        const results = [];
        for (const assign of assignments) {
            const compsForThisAssign = new Set(assign.map(a => a.compartment));
            let overlap = false;
            for (const comp of compsForThisAssign) {
                if (usedComps.has(comp)) {
                    overlap = true;
                    break;
                }
            }
            if (overlap) continue;
            const newUsed = new Set([...usedComps, ...compsForThisAssign]);
            const newPath = [...path, [current.order_no, assign]];
            results.push(...planRecursive(rest, newUsed, newPath));
        }
        return results;
    }

    // ============================================
    // --- MAIN EXECUTION AND OUTPUT FORMATTING ---
    // ============================================

    const fullAssignments = planRecursive(roundedOrders, new Set(), []);

    if (fullAssignments.length > 0) {
        const best = fullAssignments[0];
        const result = {};
        for (const [orderNo, assigns] of best) {
            result[orderNo] = assigns;
        }
        return result;
    }

    // --- NEW SUGGESTION LOGIC ---
    function findVolumeSuggestions() {
        let allSuggestions = [];

        // Iterate through each drop and each product within it to test adjustments.
        roundedOrders.forEach((drop, dropIndex) => {
            drop.products.forEach((productInfo, productIndex) => {
                const {
                    product,
                    volume: originalVolume,
                    tank_no
                } = productInfo;

                let potentialSuggestions = [];

                // Create a temporary order list *without* the product we're currently testing.
                let otherProducts = [];
                roundedOrders.forEach((d, di) => {
                    d.products.forEach((p, pi) => {
                        if (di !== dropIndex || pi !== productIndex) {
                            otherProducts.push(p);
                        }
                    });
                });

                // Get all possible assignments for the *other* products.
                const otherAssignments = getAllAssignments(otherProducts, Object.keys(truckCompartments));

                // For each valid way the other products could be loaded...
                for (const assignment of otherAssignments) {
                    const usedComps = new Set(assignment.map(a => a.compartment));
                    const availableComps = Object.keys(truckCompartments).filter(c => !usedComps.has(c));

                    // ...find all possible volume sums from the remaining compartments.
                    const possibleVolumes = new Set();
                    for (let i = 1; i <= availableComps.length; i++) {
                        getVolumeCombinationsForN(availableComps, i).forEach(combo => {
                            const sum = combo.reduce((acc, v) => acc + v, 0);
                            possibleVolumes.add(sum);
                        });
                    }

                    // Test each possible volume for the target product.
                    for (const suggestedVolume of possibleVolumes) {
                        if (suggestedVolume <= 0) continue;

                        const modifiedDrops = JSON.parse(JSON.stringify(roundedOrders));
                        modifiedDrops[dropIndex].products[productIndex].volume = suggestedVolume;

                        const retry = planRecursive(modifiedDrops, new Set(), []);
                        if (retry.length > 0) {
                            potentialSuggestions.push({
                                order_no: drop.order_no,
                                product: product,
                                tank_no: tank_no,
                                original_volume: originalVolume,
                                suggested_volume: suggestedVolume,
                                change: suggestedVolume - originalVolume
                            });
                        }
                    }
                }

                // Filter and sort the suggestions for this product.
                if (potentialSuggestions.length > 0) {
                    // Remove duplicates
                    const uniqueSuggestions = Array.from(new Map(potentialSuggestions.map(s => [s.suggested_volume, s])).values());

                    // Sort by the smallest change
                    uniqueSuggestions.sort((a, b) => Math.abs(a.change) - Math.abs(b.change));

                    // Keep the top 2 closest recommendations
                    allSuggestions.push(...uniqueSuggestions.slice(0, 2));
                }
            });
        });

        // Final cleanup of all collected suggestions to remove duplicates across different test runs
        return Array.from(new Map(allSuggestions.map(s => [`${s.order_no}-${s.product}-${s.tank_no}-${s.suggested_volume}`, s])).values());
    }

    // Helper for suggestion logic to get volume combinations for a specific number of compartments
    function getVolumeCombinationsForN(comps, n) {
        const results = [];
        const options = comps.flatMap(c => truckCompartments[c].map(v => v));
        function backtrack(start, combo) {
            if (combo.length === n) {
                results.push([...combo]);
                return;
            }
            for (let i = start; i < options.length; i++) {
                combo.push(options[i]);
                backtrack(i + 1, combo);
                combo.pop();
            }
        }
        backtrack(0, []);
        return results;
    }


    return {
        error: "No valid assignment found.",
        suggestions: findVolumeSuggestions()
    };
}

exports.fillFuelFromJobToVehicle = async (req, res, next) => {

    var xresult = [];

    return (async () => {
        let lic_code = req.header("lic_code");
        let {
            compartments,
            items,
            action
        } = req.body[0];

        //console.log(JSON.stringify(req.body[0]));
        //เช็คเฉพาะส่วนที่สำคัญ
        if (compartments == undefined || items == undefined || action == undefined) {
            let response = [{
                status: "error",
                invalid_code: "-1",
                message: "ไม่สามารถดึงข้อมูลได้, เนื่องจากข้อมูลพารามิเตอร์ไม่ถูกต้อง",
                data: xresult,
                response_time: moment().format("YYYY-MM-DD HH:mm:ss"),
            },];

            res.status(200).send(response);
        } else {

            let truck_compartment = {};
            let truck = {};

            if (compartments.length == 4) {
                truck = {
                    "Compartment 1": [0, 0],
                    "Compartment 2": [0, 0],
                    "Compartment 3": [0, 0],
                    "Compartment 4": [0, 0]
                };

                truck_compartment = {
                    "Compartment 1": "",
                    "Compartment 2": "",
                    "Compartment 3": "",
                    "Compartment 4": "",
                };
            }
            else {
                truck = {
                    "Compartment 1": [0, 0],
                    "Compartment 2": [0, 0],
                    "Compartment 3": [0, 0],
                    "Compartment 4": [0, 0],
                    "Compartment 5": [0, 0],
                    "Compartment 6": [0, 0]
                };

                truck_compartment = {
                    "Compartment 1": "",
                    "Compartment 2": "",
                    "Compartment 3": "",
                    "Compartment 4": "",
                    "Compartment 5": "",
                    "Compartment 6": "",
                };
            }

            for (var xcom = 0; xcom <= compartments.length - 1; xcom++) {
                switch (xcom) {
                    case 0:
                        truck['Compartment 1'] = [];
                        truck_compartment['Compartment 1'] = compartments[xcom].veh_compartment_code;
                        xtemporary = compartments[xcom].level_capacity.toString().split(',')
                        for (xtemp = 0; xtemp <= xtemporary.length - 1; xtemp++) {
                            if (xtemporary[xtemp] != '') {
                                truck['Compartment 1'].push(parseInt(xtemporary[xtemp]));
                            }
                        }
                        break;
                    case 1:
                        truck['Compartment 2'] = [];
                        truck_compartment['Compartment 2'] = compartments[xcom].veh_compartment_code;
                        xtemporary = compartments[xcom].level_capacity.toString().split(',')
                        for (xtemp = 0; xtemp <= xtemporary.length - 1; xtemp++) {
                            if (xtemporary[xtemp] != '') {
                                truck['Compartment 2'].push(parseInt(xtemporary[xtemp]));
                            }
                        }
                        break;
                    case 2:
                        truck['Compartment 3'] = [];
                        truck_compartment['Compartment 3'] = compartments[xcom].veh_compartment_code;
                        xtemporary = compartments[xcom].level_capacity.toString().split(',')
                        for (xtemp = 0; xtemp <= xtemporary.length - 1; xtemp++) {
                            if (xtemporary[xtemp] != '') {
                                truck['Compartment 3'].push(parseInt(xtemporary[xtemp]));
                            }
                        }
                        break;
                    case 3:
                        truck['Compartment 4'] = [];
                        truck_compartment['Compartment 4'] = compartments[xcom].veh_compartment_code;
                        xtemporary = compartments[xcom].level_capacity.toString().split(',')
                        for (xtemp = 0; xtemp <= xtemporary.length - 1; xtemp++) {
                            if (xtemporary[xtemp] != '') {
                                truck['Compartment 4'].push(parseInt(xtemporary[xtemp]));
                            }
                        }
                        break;
                    case 4:
                        truck['Compartment 5'] = [];
                        truck_compartment['Compartment 5'] = compartments[xcom].veh_compartment_code;
                        xtemporary = compartments[xcom].level_capacity.toString().split(',')
                        for (xtemp = 0; xtemp <= xtemporary.length - 1; xtemp++) {
                            if (xtemporary[xtemp] != '') {
                                truck['Compartment 5'].push(parseInt(xtemporary[xtemp]));
                            }
                        }
                        break;
                    case 5:
                        truck['Compartment 6'] = [];
                        truck_compartment['Compartment 6'] = compartments[xcom].veh_compartment_code;
                        xtemporary = compartments[xcom].level_capacity.toString().split(',')
                        for (xtemp = 0; xtemp <= xtemporary.length - 1; xtemp++) {
                            if (xtemporary[xtemp] != '') {
                                truck['Compartment 6'].push(parseInt(xtemporary[xtemp]));
                            }
                        }
                        break;
                }
            }

            // let xitems = items.sort(key=operator.itemgetter('ord_code'))
            items.sort((a, b) => {
                if (a.ord_code < b.ord_code) return -1;
                if (a.ord_code > b.ord_code) return 1;
                return 0; // names are equal
            });

            debugger
            drops = [];
            var xorder_no = ''
            var xproducts = [];
            for (var xyzr = 0; xyzr <= items.length - 1; xyzr++) {
                if (xorder_no == '') {
                    xorder_no = items[xyzr].ord_code;
                    xproducts.push(
                        {
                            product: items[xyzr].itm_code,
                            volume: parseInt(items[xyzr].item_quantity),
                            tank_no: items[xyzr].ptrl_tank_code
                        })
                }
                else {
                    if (xorder_no != items[xyzr].ord_code) {
                        //ใส่ของเดิมก่อน
                        drops.push(
                            {
                                order_no: xorder_no,
                                products: xproducts
                            });

                        xorder_no = '';
                        xproducts = [];
                        //ใส่ของใหม่
                        xorder_no = items[xyzr].ord_code;
                        xproducts.push(
                            {
                                product: items[xyzr].itm_code,
                                volume: parseInt(items[xyzr].item_quantity),
                                tank_no: items[xyzr].ptrl_tank_code
                            })
                    }
                    else {
                        xproducts.push(
                            {
                                product: items[xyzr].itm_code,
                                volume: parseInt(items[xyzr].item_quantity),
                                tank_no: items[xyzr].ptrl_tank_code
                            })
                    }
                }

                if (xyzr == items.length - 1) {
                    if (xorder_no != '') {
                        drops.push(
                            {
                                order_no: xorder_no,
                                products: xproducts
                            });
                    }
                }
            }

            var result = assignTruck(truck, drops);
            console.log(JSON.stringify(result, null, 2));
            debugger
            if (result.error != undefined && result.suggestions == undefined) {
                let response = [{
                    status: "error",
                    invalid_code: "-4",
                    message: `ไม่สามารถคำนวณข้อมูล, กรุณาตรวจสอบข้อมูลน้ำมัน`,
                    data: xresult,
                    response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
                },];
                res.status(200).send(response);
            }
            else {
                debugger
                if (result.suggestions != undefined) {
                    result.error = 'suggestions';
                }
                else {
                    for (var xbb = 0; xbb <= drops.length - 1; xbb++) {
                        if (result[drops[xbb].order_no] != undefined) {
                            for (xpp = 0; xpp <= result[drops[xbb].order_no].length - 1; xpp++) {
                                result[drops[xbb].order_no][xpp].compartment = truck_compartment[result[drops[xbb].order_no][xpp].compartment];
                                result[drops[xbb].order_no][xpp].suggestions = 0
                            }
                        }
                    }
                }

                debugger
                let response = [{
                    status: "success",
                    invalid_code: "0",
                    message: "1",
                    data: result,
                    response_time: moment().format(
                        "YYYY-MM-DD HH:mm:ss",
                    ),
                },];

                res.status(200).send(response);
                await xglobal.action_logs(
                    lic_code,
                    action[0].id,
                    "คำนวณข้อมูลน้ำมันลงถัง",
                    JSON.stringify(req.body[0]),
                    "success",
                    action[0].value,
                );
                return;
            }



        }
    })().catch(async (err) => {
        console.log(err);
        let response = [{
            status: "error",
            invalid_code: "-4",
            message: `ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ`,
            data: xresult,
            response_time: moment().format("YYYY-MM-DD HH:mm:ss").toString(),
        },];
        res.status(200).send(response);
        await xglobal.action_logs(
            lic_code,
            action[0].id,
            "คำนวณข้อมูลน้ำมันลงถัง",
            JSON.stringify(req.body[0]),
            "ไม่สามารถดึงข้อมูล, กรุณาติดต่อเจ้าหน้าที่ผู้ดูแลระบบ",
            action[0].value,
        );
        return;
    });
};


