export const ROOT_DIR = "/";

export type FileSystemObject = FileSystemDirectory | FileSystemFile;

export type FileSystemDirectory = {
	id: string;
	name: string;
	contents: Record<string, FileSystemObject>;
	createdAt: string;
	modifiedAt: string;
};

export type FileSystemFile = {
	id: string;
	name: string;
	content: string;
	createdAt: string;
	modifiedAt: string;
};

export function isDirectory(o: FileSystemObject): o is FileSystemDirectory {
	return Object.hasOwn(o, "contents");
}

export function isFile(o: FileSystemObject): o is FileSystemFile {
	return Object.hasOwn(o, "content");
}

export function newDirectory(name: string): FileSystemDirectory {
	const now = new Date().toISOString();

	return {
		id: newID(),
		name,
		contents: {},
		createdAt: now,
		modifiedAt: now,
	};
}

export function newFile(name: string): FileSystemFile {
	const now = new Date().toISOString();

	return {
		id: newID(),
		name,
		content: "",
		createdAt: now,
		modifiedAt: now,
	};
}

const idLength = 10;
const idCharSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function newID() {
	let id = "";
	for (let i = 0; i < idLength; i++) {
		id += idCharSet[Math.floor(Math.random() * idCharSet.length)];
	}
	return id;
}

export function walkFS(root: FileSystemDirectory, wd: string, path = "") {
	const combinedPath = combinePaths(wd, path);
	if (combinedPath === ROOT_DIR) {
		return [root, ROOT_DIR] as const;
	}

	const pathParts = splitPath(combinedPath);
	let dir = root;
	for (const part of pathParts) {
		const obj = dir.contents[part];
		if (!obj) {
			throw new Error("not found: " + path);
		}
		if (!isDirectory(obj)) {
			throw new Error("not a directory: " + path);
		}
		dir = obj;
	}
	return [dir, combinedPath] as const;
}

function combinePaths(wd: string, path: string) {
	const rawPath = path.startsWith(ROOT_DIR) ? path : joinPaths(wd, path);
	return simplifyPath(rawPath);
}

function simplifyPath(path: string) {
	const pathParts = splitPath(path);
	const simplifiedParts = [];
	for (const part of pathParts) {
		if (part === "..") {
			simplifiedParts.pop();
		} else {
			simplifiedParts.push(part);
		}
	}
	return joinPaths(...simplifiedParts);
}

const pathSep = "/";

function joinPaths(...paths: string[]) {
	let full = "";
	for (const path of paths) {
		if (!full.endsWith(pathSep)) {
			full += pathSep;
		}
		full += path;
	}
	return full;
}

function splitPath(path: string) {
	let trimmedPath = path;
	if (trimmedPath.startsWith(pathSep)) {
		trimmedPath = trimmedPath.slice(1);
	}
	if (trimmedPath.endsWith(pathSep)) {
		trimmedPath = trimmedPath.slice(0, -1);
	}
	return trimmedPath.split(pathSep);
}

const localStorageKey = "fs";

export function writeToDisk(fs: FileSystemDirectory) {
	localStorage.setItem(localStorageKey, JSON.stringify(fs));
}

export function readFromDisk(): FileSystemDirectory | null {
	const raw = localStorage.getItem(localStorageKey);
	if (!raw) {
		return null;
	}
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}
