// quick ugly hax so I dont have to write this in bash
const dirtyVer = process.argv[3]
const ver = dirtyVer.replaceAll('"', '').replaceAll(',', '')
console.log(ver)
