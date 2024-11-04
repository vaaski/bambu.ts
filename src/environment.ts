const getVariable = (key: string, defaultValue?: string) => {
	const value = process.env[key]

	if (value) return value
	if (defaultValue !== undefined) return defaultValue

	throw new Error(`Environment variable ${key} is not set`)
}

export const PRINTER_HOST = getVariable("PRINTER_HOST")
export const PRINTER_PORT = getVariable("PRINTER_PORT", "8883")
export const PRINTER_USERNAME = getVariable("PRINTER_USERNAME", "bblp")
export const PRINTER_PASSWORD = getVariable("PRINTER_PASSWORD")
export const PRINTER_SERIAL = getVariable("PRINTER_SERIAL")
