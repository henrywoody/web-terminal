import React from "react";
import "./App.css";

type MemoryItem = {
	type: "input" | "output";
	content: string;
};

export function App() {
	const [memory, setMemory] = React.useState<MemoryItem[]>([]);
	const [inputMemory, setInputMemory] = React.useState<string[]>([]);
	const [isRunning, setIsRunning] = React.useState(false);
	const [queue, setQueue] = React.useState<string[]>([]);

	async function onRun(raw: string) {
		setQueue((prev) => [...prev, raw]);
	}

	React.useEffect(() => {
		if (isRunning || queue.length === 0) {
			return;
		}
		run(queue[0]);
		setQueue((prev) => prev.slice(1));
	}, [isRunning, queue]);

	async function run(raw: string) {
		setMemory((prev) => [...prev, { type: "input", content: raw }]);
		setInputMemory((prev) => {
			if (prev.length > 0 && prev.at(-1) === raw) {
				return prev;
			}
			return [...prev, raw];
		});
		setIsRunning(true);
		const output = await executeInput(raw);
		setIsRunning(false);
		if (output) {
			setMemory((prev) => [...prev, { type: "output", content: output }]);
		}
	}

	async function executeInput(raw: string) {
		const parts = raw.split("|");
		let stdin = "";
		for (const part of parts) {
			try {
				const output = await executeCommand(part, stdin);
				stdin = output;
			} catch (error) {
				if (error instanceof Error) {
					return error.message;
				}
				return "";
			}
		}
		return stdin;

		async function executeCommand(raw: string, stdin: string) {
			const [func, ...args] = raw.trim().split(/\s+/);
			switch (func) {
				case "":
					return "";
				case "help":
					return "available commands:\n\necho\nclear\npwd\ncd\nsay\npbcopy\npbpaste\ncurl";
				case "echo":
					return stdin || args.join(" ");
				case "clear":
					setMemory([]);
					return "";
				case "pwd":
					return window.location.pathname;
				case "cd":
					const path = args.length === 0 ? "/" : args[0];
					const url = new URL(window.location.href);
					if (path.startsWith("/")) {
						url.pathname = path;
					} else {
						const sep = url.pathname.endsWith("/") ? "" : "/";
						url.pathname += sep + path;
					}
					history.pushState(null, "", url);
					return "";
				case "say":
					const text = stdin || args.join(" ");
					const utterance = new SpeechSynthesisUtterance(text);
					window.speechSynthesis.speak(utterance);
					return "";
				case "pbcopy":
					navigator.clipboard.writeText(stdin);
					return "";
				case "pbpaste":
					return navigator.clipboard.readText();
				case "curl":
					const targetURL = stdin || args[0];
					const response = await fetch(targetURL);
					return response.text();
				default:
					return "command not found: " + func;
			}
		}
	}

	return (
		<div className="terminal">
			<OutputArea memory={memory} />
			<InputArea onRun={onRun} inputMemory={inputMemory} isReady={!isRunning} />
		</div>
	);
}

type OutputAreaProps = {
	memory: MemoryItem[];
};

function OutputArea({ memory }: OutputAreaProps) {
	return (
		<div>
			{memory.map((e, i) => (
				<div key={i} style={{ display: "flex" }}>
					{e.type === "input" && <Prompt />}
					<pre className="terminal__text-display">{e.content}</pre>
				</div>
			))}
		</div>
	);
}

type InputAreaProps = {
	onRun: (raw: string) => void;
	inputMemory: string[];
	isReady: boolean;
};

function InputArea({ onRun, inputMemory, isReady }: InputAreaProps) {
	const [value, setValue] = React.useState("");

	const inputRef = React.useRef<HTMLInputElement | null>(null);
	React.useEffect(() => {
		function focusInput() {
			inputRef.current?.focus();
		}

		window.addEventListener("keydown", focusInput);
		return () => {
			window.removeEventListener("keydown", focusInput);
		};
	}, []);

	const inputMemoryIndexRef = React.useRef(0);
	function onKeyDown(event: React.KeyboardEvent) {
		switch (event.key) {
			case "ArrowUp":
				event.preventDefault();
				if (inputMemory.length > 0) {
					inputMemoryIndexRef.current = Math.min(inputMemoryIndexRef.current + 1, inputMemory.length);
					setValue(inputMemory[inputMemory.length - inputMemoryIndexRef.current]);
				}
				break;
			case "ArrowDown":
				event.preventDefault();
				if (inputMemory.length > 0) {
					inputMemoryIndexRef.current = Math.max(inputMemoryIndexRef.current - 1, 0);
					if (inputMemoryIndexRef.current === 0) {
						setValue(""); // TODO keep progress on last line stored
					} else {
						setValue(inputMemory[inputMemory.length - inputMemoryIndexRef.current]);
					}
				}
				break;
		}
	}

	function onSubmit(event: React.SubmitEvent) {
		event.preventDefault();
		onRun(value);
		setValue("");
		inputMemoryIndexRef.current = 0;
	}

	return (
		<form onSubmit={onSubmit} className="terminal__input-area">
			{isReady && <Prompt />}
			<input ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} autoFocus onKeyDown={onKeyDown} />
		</form>
	);
}

function Prompt() {
	return <div className="terminal__prompt">$:</div>;
}
