// test speeds of different methods of scanning hosts

let speeds = {1: 0, 2: 0}
let tests = 1000
speed()
async function speed()
{
  let id = 1
  console.log('t1, sig')
  for (let i = 0; i < tests; i++)
    await t1()
  console.log(id+': '+speeds[id]+'/'+tests+'='+(speeds[id]/tests))

  id++
  console.log('t2, big fetch')
  for (let i = 0; i < tests; i++)
    await t2()
  console.log(id+': '+speeds[id]+'/'+tests+'='+(speeds[id]/tests))
}

async function t1()
{
  const controller = new AbortController()
  const { signal } = controller
  await t({ signal: signal }, controller, 1)
}
async function t2()
{
  const controller = new AbortController()
  const { signal } = controller
  await t({ signal: signal,
    method: 'HEAD', // *GET, POST, PUT, DELETE, etc.
    mode: 'cors', // no-cors, *cors, same-origin
    cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
    credentials: 'omit', // include, *same-origin, omit
    headers: {
      //'Content-Type': 'application/json',
    },
    redirect: 'manual', // manual, *follow, error
    referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
    //body: JSON.stringify(data) // body data type must match "Content-Type" header
  }, controller, 2)
}

async function t(obj, controller, id)
{
  let p, t3
  let catcherr = function(e)
  {
    //console.log('err', e.name, e)
    if (e.name !== 'AbortError')
      t3 = window.performance.now()
  }

  setTimeout(function()
    {
      controller.abort()
    }, 1000)
  let t1 = window.performance.now()
  p = fetch(`http://192.168.0.1:1337/samyscan`, obj).catch(catcherr)
  let t2 = window.performance.now()

  await Promise.all([p]).then(function() {
    //  console.log(t1, t2, t3)
    // console.log(t2-t1)
    //console.log(t3-t1)
    //    if (!t3) { console.log('crap')}
    //console.log(speeds[id])
    speeds[id] += t3-t1
  })
}