import Vue from 'vue';
import LoadScript from 'vue-plugin-load-script';
Vue.use(LoadScript);

const initPromise = new Promise((resolve, reject) => {
    Vue.loadScript("//api.bitrix24.com/api/v1/")

    .then(() => {
        // eslint-disable-next-line no-undef
        resolve(BX24);
    })
    .catch(() => {
        reject('Failed to load BX24');
    })
})
let initialized = false;

export default function init() {
    if (initialized) return initPromise;

    initialized = true;
    return initPromise;
}