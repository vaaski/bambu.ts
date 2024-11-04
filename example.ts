import readline from "node:readline"
import * as environment from "./src/environment"
import { Bambu } from "./src"

const bambu = new Bambu({
	host: environment.PRINTER_HOST,
	password: environment.PRINTER_PASSWORD,
	serial: environment.PRINTER_SERIAL,
})

console.log("connecting")
bambu.on("connect", () => console.log("connected"))
bambu.on("disconnect", () => console.log("disconnect"))
bambu.on("state", (state) => {
	console.log(state.print.nozzle_temper)
	console.log(state.print.lights_report)
})

readline.emitKeypressEvents(process.stdin)
process.stdin.setRawMode(true)
process.stdin.on("keypress", async (_, key) => {
	switch (key.name) {
		case "1": {
			bambu.setLight(true)
			break
		}
		case "2": {
			bambu.setLight(false)
			break
		}
		case "3": {
			bambu.refreshState()
			break
		}
	}

	if (key.ctrl && key.name === "c") {
		// eslint-disable-next-line unicorn/no-process-exit
		process.exit(0)
	}
})
