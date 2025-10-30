export function sleep() {

    //randomize timeout on API calls to seem more human
    const baseDelay = Math.floor(Math.random() * 4000) + 4000;  // 4–8 sec
    const jitter = Math.floor(Math.random() * 300);             // 0–300 ms extra jitter
    const ms = baseDelay + jitter;
    console.log('==============================')
    console.log(`⏳ Sleeping for ${ms} ms...`);
    console.log('==============================')

    return new Promise(resolve => setTimeout(resolve, ms));
}