let timer: ReturnType<typeof setInterval>
let lastChecked: number = Date.now()
let callback: (res: unknown) => void
let poller: () => Promise<unknown>
let minInterval: number

async function doPoll() {
  const now = Date.now()
  const diff = now - lastChecked
  clearInterval(timer)
  if(diff > minInterval) {
    const res = await poller()
    callback(res)
    lastChecked = now
    console.log('checked', diff, res)
    timer = setInterval(doPoll, minInterval)
  } else {
    console.log('waiting', minInterval-diff)
    timer = setInterval(doPoll, minInterval-diff)
  }
}

export function start<T>(newChecker: () => Promise<T>, newCallback: (res: T) => void, newMinInterval: number) {
  console.log('start checker')
  poller = newChecker
  callback = newCallback
  minInterval = newMinInterval
  doPoll()
}

export function stop() {
  console.log('stop checker')
  clearInterval(timer)
}
