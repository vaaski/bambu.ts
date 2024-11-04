import { TypedEmitter } from "tiny-typed-emitter"

import mqtt from "mqtt"
import readline from "node:readline"

import * as environment from "./environment"
import type { BambuState } from "../types/bambu"
import { merge } from "ts-deepmerge"

export type BambuConstructorOptions = {
	host: string
	port?: string | number
	username?: string
	password: string
	serial: string

	autoconnect?: boolean
}

type BambuEvents = {
	connect: () => void
	disconnect: () => void
	state: (state: BambuState) => void
}

const defaultOptions: Partial<BambuConstructorOptions> = {
	port: 8883,
	username: "bblp",
	autoconnect: true,
}

export class Bambu extends TypedEmitter<BambuEvents> {
	private readonly options: BambuConstructorOptions
	public readonly client: mqtt.MqttClient

	private readonly commandTopic: string
	private readonly reportTopic: string
	private readonly address: string

	private _state?: BambuState

	constructor(options: BambuConstructorOptions) {
		super()

		this.options = { ...defaultOptions, ...options }

		this.commandTopic = `device/${this.options.serial}/request`
		this.reportTopic = `device/${this.options.serial}/report`
		this.address = `mqtts://${this.options.host}:${this.options.port}`

		this.client = mqtt.connect(this.address, {
			manualConnect: !this.options.autoconnect,
			username: this.options.username,
			password: this.options.password,
			reconnectPeriod: 30,
			rejectUnauthorized: false,
		})

		this.client.on("connect", () => {
			this.emit("connect")
			this.client.subscribe(this.reportTopic)
			this.refreshState()
		})

		this.client.on("disconnect", () => {
			this.emit("disconnect")
		})

		this.client.on("message", this.handleMessage)
	}

	private readonly handleMessage = (topic: string, message: Buffer) => {
		const parsed = JSON.parse(message.toString()) as BambuState

		if (!this._state) this._state = parsed
		this._state = merge.withOptions(
			{ mergeArrays: false, uniqueArrayItems: false },
			this._state,
			parsed,
		)

		this.emit("state", this._state)
	}

	private readonly sendCommandRaw = (command: string) => {
		this.client.publish(this.commandTopic, command)
	}

	// --------------------------------------------------------------------------------

	public readonly refreshState = async () => {
		this.sendCommandRaw(JSON.stringify({ pushing: { command: "pushall" } }))
	}

	public readonly setLight = (state: boolean) => {
		this.sendCommandRaw(JSON.stringify({ system: { led_mode: state ? "on" : "off" } }))
	}
}

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
