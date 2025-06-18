import Vue from 'vue';

export const bx24methods = {
    methods: {
        async fetchSettings() {
            // eslint-disable-next-line no-unused-vars
            return new Promise(function (resolve, reject) {
                // eslint-disable-next-line no-undef
                let bx24 = BX24;
                bx24.callMethod('entity.item.get', {
                    ENTITY: 'SETTINGS',
                    SORT: {DATE_ACTIVE_FROM: 'ASC', ID: 'ASC'},
                    FILTER: {}
                }, (reponse) => {
                    let result = {};
                    reponse.answer.result.forEach((set) => {
                        result[set.NAME] = {}
                        result[set.NAME].VALUE = JSON.parse(set.PROPERTY_VALUES.VALUE)
                        result[set.NAME].ID = set.ID

                    })
                    resolve(result)
                })
            })
        },

        async callMethod(methodName, params) {
            return new Promise(function (resolve, reject) {
                let result = [];
                Vue.prototype.$eventBus.$emit('preloader')
                // eslint-disable-next-line no-undef
                BX24.callMethod(methodName, params, function (response) {

                    if (response.error()) {
                        console.error("Ошибка !!! \n" + response.error());
                        reject(response.error())
                    } else {
                        result = result.concat(response.data());

                        if (response.answer.total / 50 > 3) {
                            let requests = [];
                            let ind = 0;
                            for (let k = 50; k <= response.answer.total; k += 50) {
                                params.start = k;
                                requests[ind] = !requests[ind] ? {} : requests[ind];
                                requests[ind][methodName + "_" + k] = {
                                    method: methodName,
                                    params: JSON.parse(JSON.stringify(params))
                                }
                                if (Object.entries(requests[ind]).length >= 50) ind++;
                            }
                            let promises = []
                            requests.forEach((el) => promises.push(tert(el)))

                            Promise.all(promises).then((values => {
                                let finalResult = result
                                values.forEach(el => finalResult = finalResult.concat(el));
                                Vue.prototype.$eventBus.$emit('preloader')
                                resolve(finalResult);
                            }))
                        } else if (response.more()) {
                            response.next();
                        } else {
                            Vue.prototype.$eventBus.$emit('preloader')
                            resolve(result);
                        }
                    }
                });
            })
        },

        async pageNavigationMethod(methodName, params) {
            return new Promise(function (resolve, reject) {
                let result = [];
                let pages;
                Vue.prototype.$eventBus.$emit('preloader')

                // eslint-disable-next-line no-undef
                BX24.callMethod(methodName, params, function (response) {
                    if (response.error()) {
                        console.error("Ошибка !!! \n" + response.error());
                        reject(response.error())
                    } else {
                        result = result.concat(response.data());
                        pages = Math.ceil(response.answer.total / 50);
                        let promises = [];
                        while (pages > 1) {
                            params[3]['NAV_PARAMS']['iNumPage']++;
                            promises.push(new Promise((resolve2) => {
                                // eslint-disable-next-line no-undef
                                BX24.callMethod(methodName, params, function (response) {
                                    resolve2(response.data());
                                })
                            }))
                            pages--;
                        }
                        Promise.all(promises).then((values => {
                            let finalResult = result
                            values.forEach(el => finalResult = finalResult.concat(el));
                            Vue.prototype.$eventBus.$emit('preloader')
                            resolve(finalResult);
                        }))
                    }
                });
            })
        }
    },
};

function tert(request) {
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject) {
        let reslt = []
        // eslint-disable-next-line no-undef
        BX24.callBatch(request, function (resp) {
                Object.values(resp).forEach((row) => {
                    reslt = reslt.concat(Object.values(row.answer.result))
                });
                resolve(reslt);
            },
            true);
    })
}

// function sleep(ms) {
//     return new Promise(resolve => setTimeout(resolve, ms));
// }
