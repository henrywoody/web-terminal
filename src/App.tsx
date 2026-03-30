import React from "react";
import { isDirectory, isFile, newDirectory, newFile, readFromDisk, ROOT_DIR, walkFS, writeToDisk } from "./file-system";
import "./App.css";

type MemoryItem = {
	type: "input" | "output";
	content: string;
};

const inputMemoryLocalStorageKey = "inputMemory";

export function App() {
	const [memory, setMemory] = React.useState<MemoryItem[]>([]);
	const [inputMemory, setInputMemory] = React.useState<string[]>(() => {
		const raw = localStorage.getItem(inputMemoryLocalStorageKey);
		if (!raw) {
			return [];
		}
		try {
			return JSON.parse(raw);
		} catch {
			return [];
		}
	});
	React.useEffect(() => {
		localStorage.setItem(inputMemoryLocalStorageKey, JSON.stringify(inputMemory));
	}, [inputMemory]);
	const [isRunning, setIsRunning] = React.useState(false);
	const [queue, setQueue] = React.useState<string[]>([]);

	const fileSystemRef = useLazyRef(() => readFromDisk() || newDirectory(""));
	const [workingDirectory] = walkFS(fileSystemRef.current, window.location.pathname);

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
			if (raw === "" || (prev.length > 0 && prev.at(-1) === raw)) {
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
					return "available commands:\n\nhelp\necho\nclear\nhistory\nhead\ntail\npwd\nls\ncd\nmkdir\ntouch\nrm\ncat\nsay\npbcopy\npbpaste\ncurl";
				case "echo":
					return stdin || args.join(" ");
				case "clear":
					setMemory([]);
					return "";
				case "history":
					return inputMemory
						.map((e, i) => (i + 1).toString().padEnd(inputMemory.length.toString().length) + "  " + e)
						.join("\n");
				case "head":
					const headContent = stdin;
					let headLineCount = 0;
					for (let i = 0; i < headContent.length; i++) {
						if (headContent[i] === "\n") {
							headLineCount++;
						}
						if (headLineCount >= 10) {
							return headContent.slice(0, i);
						}
					}
					return headContent;
				case "tail":
					const tailContent = stdin;
					let tailLineCount = 0;
					for (let i = tailContent.length - 1; i >= 0; i--) {
						if (tailContent[i] === "\n") {
							tailLineCount++;
						}
						if (tailLineCount >= 10) {
							return tailContent.slice(i + 1);
						}
					}
					return tailContent;
				case "pwd":
					return window.location.pathname;
				case "ls":
					return Object.values(workingDirectory.contents)
						.map((e) => e.name)
						.join("\n");
				case "cd":
					const path = args.length === 0 ? ROOT_DIR : stdin || args[0];
					const endPath = walkFS(fileSystemRef.current, window.location.pathname, path)[1];
					const url = new URL(window.location.href);
					url.pathname = endPath;
					history.pushState(null, "", url);
					return "";
				case "mkdir":
					const dirName = stdin || args[0];
					if (!dirName) {
						throw new Error("name is required");
					}
					// TODO needs to combine paths
					if (dirName in workingDirectory.contents) {
						throw new Error(dirName + ": exists");
					}
					const createdDir = newDirectory(dirName);
					workingDirectory.contents[dirName] = createdDir;
					writeToDisk(fileSystemRef.current);
					return "";
				case "touch":
					const fileName = stdin || args[0];
					if (!fileName) {
						throw new Error("name is required");
					}
					// TODO needs to combine paths
					if (fileName in workingDirectory.contents) {
						return "";
					}
					const createdFile = newFile(fileName);
					workingDirectory.contents[fileName] = createdFile;
					writeToDisk(fileSystemRef.current);
					return "";
				case "rm":
					const isRecursive = args[0] === "-r";
					const rmName = stdin || (isRecursive ? args[1] : args[0]);
					if (!rmName) {
						throw new Error("name is required");
					}
					const rmTarget = workingDirectory.contents[rmName]; // TODO needs to combine paths
					if (!rmTarget) {
						throw new Error(rmName + ": No such file or directory");
					}
					if (!isRecursive && isDirectory(rmTarget)) {
						throw new Error(rmName + ": is a directory");
					}
					delete workingDirectory.contents[rmName];
					writeToDisk(fileSystemRef.current);
					return "";
				case "cat":
					const catFileName = stdin || args[0];
					const file = workingDirectory.contents[catFileName]; // TODO needs to combine paths
					if (!file) {
						throw new Error("not found");
					}
					if (!isFile(file)) {
						throw new Error("not a file: " + catFileName);
					}
					return file.content;
				case "say":
					const text = stdin || args.join(" ");
					const utterance = new SpeechSynthesisUtterance(text);
					window.speechSynthesis.speak(utterance);
					return "";
				case "pbcopy":
					await navigator.clipboard.writeText(stdin);
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

function useLazyRef<T>(initial: T | (() => T)) {
	const [initialValue] = React.useState(initial);
	return React.useRef(initialValue);
}
