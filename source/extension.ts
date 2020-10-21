import * as vscode from 'vscode';
import * as vscel from '@wraith13/vscel';
import packageJson from "../package.json";
import localeEn from "../package.nls.json";
import localeJa from "../package.nls.ja.json";
const locale = vscel.locale.make(localeEn, { "ja": localeJa });
const profile = vscel.profiler.profile;
interface ScopeTerms
{
    opening: string;
    closing: string;
}
type HeaderMode = "before" | "smart" | "inner";
interface BracketTrait extends ScopeTerms
{
    headerMode?: HeaderMode;
    inters?: string[];
}
interface StringTrait extends ScopeTerms
{
    escape: string;
}
interface LanguageConfiguration
{
    ignoreCase: boolean;
    comments?:
    {
        block?: ScopeTerms[],
        line?: string[]
    },
    brackets?:
    {
        symbol?: BracketTrait[];
        word?: BracketTrait[];
    }
    strings?:
    {
        inline?: StringTrait[];
        multiline?: StringTrait[];
    }
}
module Config
{
    export const root = vscel.config.makeRoot(packageJson);
    export const enabled = root.makeEntry<boolean>("bracketLens.enabled");
    export const debug = root.makeEntry<boolean>("bracketLens.debug");
    export const color = root.makeEntry<string>("bracketLens.color");
    export const prefix = root.makeEntry<string>("bracketLens.prefix");
    export const unmatchBracketsPrefix = root.makeEntry<string>("bracketLens.unmatchBracketsPrefix");
    export const maxBracketHeaderLength = root.makeEntry<number>("bracketLens.maxBracketHeaderLength");
    export const minBracketScopeLines = root.makeEntry<number>("bracketLens.minBracketScopeLines");
    export const languageConfiguration = root.makeEntry<LanguageConfiguration>("bracketLens.languageConfiguration");
}
const debug = (output: any) =>
{
    if (Config.debug.get(""))
    {
        console.debug(output);
    }
};
let profilerOutputChannel: vscode.OutputChannel | undefined = undefined;
const getProfilerOutputChannel = () => profilerOutputChannel ?
    profilerOutputChannel:
    (profilerOutputChannel = vscode.window.createOutputChannel("Bracket Lens Profiler"));
interface TokenEntry
{
    position: vscode.Position;
    token: string;
}
interface BracketEntry
{
    start: TokenEntry;
    end: TokenEntry;
    headerMode: HeaderMode;
    isUnmatchBrackets: boolean;
    items: BracketEntry[];
}
interface BracketContext
{
    parentEntry: BracketEntry | undefined;
    previousEntry: BracketEntry | undefined;
    entry: BracketEntry;
    nextEntry: BracketEntry | undefined;
}
interface BracketDecorationSource
{
    range: vscode.Range;
    bracketHeader: string;
}
class DocumentDecorationCacheEntry
{
    brackets: BracketEntry[];
    decorationSource: BracketDecorationSource[] = [];
    public constructor(document: vscode.TextDocument)
    {
        this.brackets = parseBrackets(document);
        this.decorationSource = getBracketDecorationSource(document, this.brackets);
        documentDecorationCache.set(document, this);
    }
}
class EditorDecorationCacheEntry
{
    private isDirtyValue: boolean = false;
    private bracketHeaderInformationDecoration?: vscode.TextEditorDecorationType;
    public constructor(editor: vscode.TextEditor)
    {
        editorDecorationCache.set(editor, this);
    }
    public isDirty = () => this.isDirtyValue;
    public setDirty = () =>
    {
        this.isDirtyValue = true;
    };
    public setBracketHeaderInformationDecoration = (bracketHeaderInformationDecoration?: vscode.TextEditorDecorationType) =>
    {
        this.dispose();
        this.bracketHeaderInformationDecoration = bracketHeaderInformationDecoration;
    };
    public dispose = () =>
    {
        this.bracketHeaderInformationDecoration?.dispose();
        this.bracketHeaderInformationDecoration = undefined;
        this.isDirtyValue = false;
    };
}
const documentDecorationCache = new Map<vscode.TextDocument, DocumentDecorationCacheEntry>();
const makeSureDocumentDecorationCache = (document: vscode.TextDocument) =>
    documentDecorationCache.get(document) ?? new DocumentDecorationCacheEntry(document);
const editorDecorationCache = new Map<vscode.TextEditor, EditorDecorationCacheEntry>();
const makeSureEditorDecorationCache = (textEditor: vscode.TextEditor) =>
    editorDecorationCache.get(textEditor) ?? new EditorDecorationCacheEntry(textEditor);
export const regExpExecToArray = (regexp: RegExp, text: string) => profile
(
    `regExpExecToArray(/${regexp.source}/${regexp.flags})`,
    () =>
    {
        const result: RegExpExecArray[] = [];
        while(true)
        {
            const match = regexp.exec(text);
            if (null === match)
            {
                break;
            }
            result.push(match);
        }
        return result;
    }
);
const makeRegExpPart = (text: string) => text.replace(/([\\\/\*\[\]\(\)\{\}\|])/gmu, "\\$1").replace(/\s+/, "\\s");
const isInlineScope = (bracket: BracketEntry) => bracket.end.position.line <= bracket.start.position.line;
const parseBrackets = (document: vscode.TextDocument) => profile
(
    "parseBrackets",
    (): BracketEntry[] =>
    {
        const result:BracketEntry[] = [];
        const languageConfiguration = Config.languageConfiguration.get(document.languageId);
        const regulate = languageConfiguration.ignoreCase ?
            (text: string) => text.replace(/\s+/, " ").toLowerCase():
            (text: string) => text.replace(/\s+/, " ");
        const openingBlockComments = languageConfiguration.comments?.block?.map(i => regulate(i.opening)) ?? [];
        const closingBlockComments = languageConfiguration.comments?.block?.map(i => regulate(i.closing)) ?? [];
        const lineComments = languageConfiguration.comments?.line?.map(regulate) ?? [];
        const openingSymbolBrackets = languageConfiguration.brackets?.symbol?.map(i => regulate(i.opening)) ?? [];
        const symbolBracketInters = languageConfiguration.brackets?.symbol?.map(i => i.inters?.map(regulate) ?? [])?.reduce((a, b) => a.concat(b), []) ?? [];
        const closingSymbolBrackets = languageConfiguration.brackets?.symbol?.map(i => regulate(i.closing)) ?? [];
        const symbolBracketsHeader = languageConfiguration.brackets?.symbol?.map(i => i.headerMode ?? "smart") ?? [];
        const openingWordBrackets = languageConfiguration.brackets?.word?.map(i => regulate(i.opening)) ?? [];
        const wordBracketInters = languageConfiguration.brackets?.word?.map(i => i.inters?.map(regulate) ?? [])?.reduce((a, b) => a.concat(b), []) ?? [];
        const closingWordBrackets = languageConfiguration.brackets?.word?.map(i => regulate(i.closing)) ?? [];
        const wordBracketsHeader = languageConfiguration.brackets?.word?.map(i => i.headerMode ?? "inner") ?? [];
        const openingInlineStrings = languageConfiguration.strings?.inline?.map(i => regulate(i.opening)) ?? [];
        const escapeInlineStrings = languageConfiguration.strings?.inline?.map(i => regulate(i.escape)) ?? [];
        const closingInlineStrings = languageConfiguration.strings?.inline?.map(i => regulate(i.closing)) ?? [];
        const openingMultilineStrings = languageConfiguration.strings?.multiline?.map(i => regulate(i.opening)) ?? [];
        const escapeMultilineStrings = languageConfiguration.strings?.multiline?.map(i => regulate(i.escape)) ?? [];
        const closingMultilineStrings = languageConfiguration.strings?.multiline?.map(i => regulate(i.closing)) ?? [];
        const pattern = (<string[]>[])
            .concat(openingBlockComments)
            .concat(closingBlockComments)
            .concat(lineComments)
            .concat(openingSymbolBrackets)
            .concat(symbolBracketInters)
            .concat(closingSymbolBrackets)
            .concat(openingWordBrackets)
            .concat(wordBracketInters)
            .concat(closingWordBrackets)
            .concat(openingInlineStrings)
            .concat(escapeInlineStrings)
            .concat(closingInlineStrings)
            .concat(openingMultilineStrings)
            .concat(escapeMultilineStrings)
            .concat(closingMultilineStrings)
            .filter((entry, index, array) => "" !== entry && index === array.indexOf(entry))
            .map(i => `${makeRegExpPart(i)}`)
            .join("|");
        const text = document.getText();
        const tokens = regExpExecToArray
        (
            new RegExp
            (
                pattern,
                languageConfiguration.ignoreCase ?
                    "gui":
                    "gu"
            ),
            text
        )
        .map
        (
            match =>
            ({
                index: match.index,
                token: match[0],
            })
        );
        const getCharactoer = (index: number) => index < 0 ? "":
            document.getText
            (
                new vscode.Range
                (
                    document.positionAt(index),
                    document.positionAt(index +1)
                )
            );
        const isIncludeWord = (text: string) => text.replace(/\w/, "").length < text.length;
        const isSureMatchWord = (match: { index: number, token: string}) =>
            !isIncludeWord(getCharactoer(match.index -1)) &&
            !isIncludeWord(getCharactoer(match.index +match.token.length));
        profile
        (
            "parseBrackets.scan",
            () =>
            {
                let scopeStack: { start: TokenEntry, closing:string, headerMode: HeaderMode, items: BracketEntry[] }[] = [];
                let i = 0;
                const writeCore = (entry: BracketEntry) => profile
                (
                    "parseBrackets.scan.writeCore",
                    () =>
                    {
                        if ( ! isInlineScope(entry) || entry.isUnmatchBrackets)
                        {
                            const parent = scopeStack[scopeStack.length -1];
                            if (parent)
                            {
                                parent.items.push(entry);
                            }
                            else
                            {
                                result.push(entry);
                            }
                        }
                    }
                );
                const write = (closingToken: { index: number, token: string }) => profile
                (
                    "parseBrackets.scan.write",
                    () =>
                    {
                        const scope = scopeStack.pop();
                        if (scope)
                        {
                            writeCore
                            ({
                                start: scope.start,
                                end:
                                {
                                    position: document.positionAt(closingToken.index +closingToken.token.length),
                                    token: closingToken.token,
                                },
                                headerMode: scope.headerMode,
                                isUnmatchBrackets: scope.closing !== regulate(closingToken.token),
                                items: scope.items,
                            });
                        }
                        else
                        {
                            //  余分な閉じ括弧
                            writeCore
                            ({
                                start:
                                {
                                    position: document.positionAt(closingToken.index),
                                    token: closingToken.token,
                                },
                                end:
                                {
                                    position: document.positionAt(closingToken.index +closingToken.token.length),
                                    token: closingToken.token,
                                },
                                headerMode: "smart",
                                isUnmatchBrackets: true,
                                items: [],
                            });
                        }
                    }
                );
                while(i < tokens.length)
                {
                    const token = regulate(tokens[i].token);
                    if (0 <= openingBlockComments.indexOf(token))
                    {
                        profile
                        (
                            "parseBrackets.scan.blockComment",
                            () =>
                            {
                                const closing = closingBlockComments[openingBlockComments.indexOf(token)];
                                while(++i < tokens.length)
                                {
                                    if (closing === regulate(tokens[i].token))
                                    {
                                        ++i;
                                        break;
                                    }
                                }
                            }
                        );
                    }
                    else
                    if (0 <= lineComments.indexOf(token))
                    {
                        profile
                        (
                            "parseBrackets.scan.lineComment",
                            () =>
                            {
                                const line = document.positionAt(tokens[i].index).line;
                                while(++i < tokens.length)
                                {
                                    if (line !== document.positionAt(tokens[i].index).line)
                                    {
                                        break;
                                    }
                                }
                            }
                        );
                    }
                    else
                    if (0 <= openingSymbolBrackets.indexOf(token))
                    {
                        profile
                        (
                            "parseBrackets.scan.openingSymbolBracket",
                            () =>
                            {
                                const index = openingSymbolBrackets.indexOf(token);
                                scopeStack.push
                                ({
                                    start:
                                    {
                                        position: document.positionAt(tokens[i].index),
                                        token: tokens[i].token,
                                    },
                                    closing: closingSymbolBrackets[index],
                                    headerMode: symbolBracketsHeader[index],
                                    items: [],
                                });
                                ++i;
                            }
                        );
                    }
                    else
                    if (0 <= openingWordBrackets.indexOf(token) && isSureMatchWord(tokens[i]))
                    {
                        profile
                        (
                            "parseBrackets.scan.openingWordBracket",
                            () =>
                            {
                                const index = openingWordBrackets.indexOf(token);
                                scopeStack.push
                                ({
                                    start:
                                    {
                                        position: document.positionAt(tokens[i].index),
                                        token: tokens[i].token,
                                    },
                                    closing: closingWordBrackets[index],
                                    headerMode: wordBracketsHeader[index],
                                    items: [],
                                });
                                ++i;
                            }
                        );
                    }
                    else
                    if
                    (
                        0 <= closingSymbolBrackets.indexOf(token) ||
                        (0 <= closingWordBrackets.indexOf(token) && isSureMatchWord(tokens[i]))
                    )
                    {
                        profile
                        (
                            "parseBrackets.scan.closingBracket",
                            () =>
                            {
                                write(tokens[i]);
                                ++i;
                            }
                        );
                    }
                    else
                    if (0 <= openingInlineStrings.indexOf(token))
                    {
                        profile
                        (
                            "parseBrackets.scan.inlineString",
                            () =>
                            {
                                const line = document.positionAt(tokens[i].index).line;
                                const closing = closingInlineStrings[openingInlineStrings.indexOf(token)];
                                while(++i < tokens.length)
                                {
                                    if (line !== document.positionAt(tokens[i].index).line)
                                    {
                                        break;
                                    }
                                    if (closing === regulate(tokens[i].token))
                                    {
                                        ++i;
                                        break;
                                    }
                                }
                            }
                        );
                    }
                    else
                    if (0 <= openingMultilineStrings.indexOf(token))
                    {
                        profile
                        (
                            "parseBrackets.scan.multilineString",
                            () =>
                            {
                                const closing = closingMultilineStrings[openingMultilineStrings.indexOf(token)];
                                while(++i < tokens.length)
                                {
                                    if (closing === regulate(tokens[i].token))
                                    {
                                        ++i;
                                        break;
                                    }
                                }
                            }
                        );
                    }
                    else
                    {
                        debug(`unmatch-token: ${JSON.stringify(tokens[i])}`);
                        ++i;
                    }
                };
                profile
                (
                    "parseBrackets.scan.rest",
                    () =>
                    {
                        while(0 < scopeStack.length)
                        {
                            write({ index: text.length, token: ""});
                        }
                    }
                );
            }
        );
        return result;
    }
);
module position
{
    export const nextLine = (position: vscode.Position, increment: number = 1) => new vscode.Position
        (
            position.line +increment,
            0
        );
    export const nextCharacter = (position: vscode.Position, increment: number = 1) => new vscode.Position
        (
            position.line,
            position.character +increment
        );
    export const min = (positions: vscode.Position[]) =>
        positions.reduce((a, b) => a.isBefore(b) ? a: b, positions[0]);
    export const max = (positions: vscode.Position[]) =>
        positions.reduce((a, b) => a.isAfter(b) ? a: b, positions[0]);
}
const getBracketHeader =
(
    document: vscode.TextDocument,
    context: BracketContext
) => profile
(
    "getBracketHeader",
    (): string =>
    {
        const maxBracketHeaderLength = Config.maxBracketHeaderLength.get(document.languageId);
        const regulateHeader = (text: string) =>
        {
            let result = text.replace(/\s+/gu, " ").trim();
            if (maxBracketHeaderLength < result.length)
            {
                return result.substring(0, maxBracketHeaderLength -3) +"...";
            }
            return result;
        };
        const isValidHeader = (text: string) => 0 < text
            //.replace(/\W/gmu, "")
            .replace(/,/gmu, "")
            .trim().length;
        if ("inner" !== context.entry.headerMode)
        {
            const topLimit =
            context.previousEntry?.end.position ??
            (
                undefined !== context.parentEntry ?
                    position.nextCharacter
                    (
                        context.parentEntry.start.position,
                        context.parentEntry.start.token.length
                    ):
                    new vscode.Position(0, 0)
            );
            const lineHead = position.max
            ([
                topLimit,
                position.nextLine(context.entry.start.position, 0),
            ]);
            const currnetLineHeader = regulateHeader(document.getText(new vscode.Range(lineHead, context.entry.start.position)));
            if (isValidHeader(currnetLineHeader))
            {
                return currnetLineHeader;
            }
            if (topLimit.line < context.entry.start.position.line)
            {
                const previousLineHead = position.max
                ([
                    topLimit,
                    position.nextLine(context.entry.start.position, -1),
                ]);
                const previousLineHeader = regulateHeader(document.getText(new vscode.Range(previousLineHead, lineHead)));
                if (isValidHeader(previousLineHeader))
                {
                    return previousLineHeader;
                }
            }
        }
        if ("before" !== context.entry.headerMode)
        {
            const currnetLineInnerHeader = regulateHeader
            (
                document.getText
                (
                    new vscode.Range
                    (
                        context.entry.start.position,
                        // position.nextCharacter
                        // (
                        //     context.entry.start.position,
                        //     context.entry.start.token.length
                        // ),
                        position.nextLine(context.entry.start.position, +1)
                    )
                )
            );
            if (isValidHeader(currnetLineInnerHeader) && currnetLineInnerHeader !== regulateHeader(context.entry.start.token))
            {
                return currnetLineInnerHeader;
            }
            const innerHeader = regulateHeader
            (
                document.getText
                (
                    new vscode.Range
                    (
                        context.entry.start.position,
                        position.min
                        ([
                            position.nextLine(context.entry.start.position, +16),
                            context.entry.end.position,
                        ])
                    )
                )
            );
            if (isValidHeader(innerHeader))
            {
                return innerHeader;
            }
        }
        return "";
    }
);
export const getBracketDecorationSource = (document: vscode.TextDocument, brackets: BracketEntry[]) => profile
(
    "getBracketDecorationSource",
    () =>
    {
        const prefix = Config.prefix.get(document.languageId);
        const unmatchBracketsPrefix = Config.unmatchBracketsPrefix.get(document.languageId);
        const minBracketScopeLines = Config.minBracketScopeLines.get(document.languageId);
        const result: BracketDecorationSource[] = [];
        const scanner = (context: BracketContext) =>
        {
            if (minBracketScopeLines <= (context.entry.end.position.line -context.entry.start.position.line) +1)
            {
                if
                (
                    // 後続ブロックが閉じと同じ行で始まる場合はスキップ
                    context.entry.end.position.line < (context.nextEntry?.start.position.line ?? document.lineCount +1) &&
                    // 親の閉じと同じ行になる場合は親を優先
                    context.entry.end.position.line < (context.parentEntry?.end.position.line ?? document.lineCount +1)
                )
                {
                    const bracketHeader = getBracketHeader(document, context);
                    if (0 < bracketHeader.length)
                    {
                        result.push
                        ({
                            range: new vscode.Range
                            (
                                position.nextCharacter(context.entry.end.position, -context.entry.end.token.length),
                                context.entry.end.position
                            ),
                            bracketHeader: `${context.entry.isUnmatchBrackets ? unmatchBracketsPrefix: prefix}${bracketHeader}`,
                        });
                    }
                }
                context.entry.items.map
                (
                    (entry, index, array) => scanner
                    ({
                        parentEntry: context.entry,
                        previousEntry: array[index -1],
                        entry,
                        nextEntry: array[index +1],
                    })
                );
            }
        };
        brackets.map
        (
            (entry, index, array) => scanner
            ({
                parentEntry: undefined,
                previousEntry: array[index -1],
                entry,
                nextEntry: array[index +1],
            })
        );
        return result;
    }
);
export const updateDecoration = (textEditor: vscode.TextEditor) => profile
(
    "updateDecoration",
    () =>
    {
        if (Config.enabled.get(textEditor.document.languageId))
        {
            const editorCache = editorDecorationCache.get(textEditor);
            if (undefined === editorCache || editorCache.isDirty())
            {
                const bracketHeaderInformationDecoration = vscode.window.createTextEditorDecorationType
                ({
                    isWholeLine: true,
                    //color,
                });
                const options: vscode.DecorationOptions[] = [];
                const color = Config.color.get(textEditor.document.languageId);
                makeSureDocumentDecorationCache(textEditor.document).decorationSource.forEach
                (
                    i => options.push
                    ({
                        range: i.range,
                        renderOptions:
                        {
                            after:
                            {
                                contentText: i.bracketHeader,
                                color,
                            }
                        }
                    })
                );
                makeSureEditorDecorationCache(textEditor)
                    .setBracketHeaderInformationDecoration(bracketHeaderInformationDecoration);
                profile
                (
                    "textEditor.setDecorations",
                    () => textEditor.setDecorations
                    (
                        bracketHeaderInformationDecoration,
                        options
                    )
                );
            }
        }
        else
        {
            editorDecorationCache.get(textEditor)?.dispose();
            editorDecorationCache.delete(textEditor);
        }
    }
);
export const onDidChangeConfiguration = () =>
{
    Config.root.entries.forEach(i => i.clear());
    clearAllDecorationCache();
    updateAllDecoration();
};
const valueThen = <ValueT, ResultT>(value: ValueT | undefined, f: (value: ValueT) => ResultT) =>
{
    if (value)
    {
        return f(value);
    }
    return undefined;
};
const activeTextEditor = <T>(f: (textEditor: vscode.TextEditor) => T) => valueThen(vscode.window.activeTextEditor, f);
export const clearAllDecorationCache = (): void =>
{
    documentDecorationCache.clear();
    for(const textEditor of editorDecorationCache.keys())
    {
        editorDecorationCache.get(textEditor)?.setDirty();
    }
};
export const clearDecorationCache = (document?: vscode.TextDocument): void =>
{
    if (document)
    {
        documentDecorationCache.delete(document);
        for(const textEditor of editorDecorationCache.keys())
        {
            if (document === textEditor.document)
            {
                editorDecorationCache.get(textEditor)?.setDirty();
            }
        }
    }
    for(const textEditor of editorDecorationCache.keys())
    {
        if (vscode.window.visibleTextEditors.indexOf(textEditor) < 0)
        {
            editorDecorationCache.get(textEditor)?.dispose();
            editorDecorationCache.delete(textEditor);
        }
    }
};
const getDocumentTextLength = (document: vscode.TextDocument) => document.offsetAt
(
    document.lineAt(document.lineCount - 1).range.end
);
//const isClip = (lang: string, textLength: number) => clipByVisibleRange.get(lang)(textLength / Math.max(fileSizeLimit.get(lang), 1024));
const lastUpdateStamp = new Map<vscode.TextEditor, number>();
export const delayUpdateDecoration = (textEditor: vscode.TextEditor): void =>
{
    const updateStamp = vscel.profiler.getTicks();
    lastUpdateStamp.set(textEditor, updateStamp);
    const textLength = getDocumentTextLength(textEditor.document);
    const logUnit = 16 *1024;
    const logRate = Math.pow(Math.max(textLength, logUnit) / logUnit, 1.0 / 2.0);
    //const lang = textEditor.document.languageId;
    const delay = false ? //isClip(lang, textLength) ?
            30: // clipDelay.get(lang):
            logRate *
            (
                100 + //basicDelay.get(lang) +
                (
                    undefined === documentDecorationCache.get(textEditor.document) ?
                        100: // additionalDelay.get(lang):
                        0
                )
            );
    //debug(`document: ${textEditor.document.fileName}, textLength: ${textLength}, logRate: ${logRate}, delay: ${delay}`);
    setTimeout
    (
        () =>
        {
            if (lastUpdateStamp.get(textEditor) === updateStamp)
            {
                lastUpdateStamp.delete(textEditor);
                updateDecoration(textEditor);
            }
        },
        delay
    );
};
export const updateAllDecoration = () =>
    vscode.window.visibleTextEditors
        .filter(i => undefined !== i.viewColumn)
        .forEach(i => delayUpdateDecoration(i));
export const onDidChangeWorkspaceFolders = onDidChangeConfiguration;
export const onDidChangeActiveTextEditor = (): void =>
{
    clearDecorationCache();
    activeTextEditor(delayUpdateDecoration);
};
export const onDidCloseTextDocument = clearDecorationCache;
export const onDidChangeTextDocument = (document: vscode.TextDocument): void =>
{
    clearDecorationCache(document);
    vscode.window.visibleTextEditors
        .filter(i => undefined !== i.viewColumn)
        .filter(i => i.document === document)
        .forEach(i => delayUpdateDecoration(i));
};
export let extensionContext: vscode.ExtensionContext;
export const activate = async (context: vscode.ExtensionContext) =>
{
    extensionContext = context;
    vscel.profiler.start();
    context.subscriptions.push
    (
        vscode.commands.registerCommand
        (
            `bracketLens.reportProfile`, () =>
            {
                const outputChannel = getProfilerOutputChannel();
                outputChannel.show();
                if (vscel.profiler.getIsProfiling())
                {
                    outputChannel.appendLine(`${locale.map("📊 Profile Report")} - ${new Date()}`);
                    const overall = vscel.profiler.getOverall();
                    const total = vscel.profiler.getReport().map(i => i.ticks).reduce((p, c) => p +c);
                    outputChannel.appendLine(locale.map("⚖ Overview"));
                    outputChannel.appendLine(`- Overall: ${overall.toLocaleString()}ms ( ${vscel.profiler.percentToDisplayString(1)} )`);
                    outputChannel.appendLine(`- Busy: ${total.toLocaleString()}ms ( ${vscel.profiler.percentToDisplayString(total / overall)} )`);
                    outputChannel.appendLine(locale.map("🔬 Busy Details"));
                    outputChannel.appendLine(`- Total: ${total.toLocaleString()}ms ( ${vscel.profiler.percentToDisplayString(1)} )`);
                    vscel.profiler.getReport().forEach(i => outputChannel.appendLine(`- ${i.name}: ${i.ticks.toLocaleString()}ms ( ${vscel.profiler.percentToDisplayString(i.ticks / total)} )`));
                    outputChannel.appendLine("");
                }
                else
                {
                    outputChannel.appendLine(locale.map("🚫 Profile has not been started."));
                }
            }
        ),
        vscode.workspace.onDidChangeConfiguration
        (
            async (event) =>
            {
                if (event.affectsConfiguration("bracketLens"))
                {
                    onDidChangeConfiguration();
                }
            }
        ),
        vscode.workspace.onDidChangeWorkspaceFolders(() => onDidChangeWorkspaceFolders()),
        vscode.workspace.onDidChangeTextDocument(event => onDidChangeTextDocument(event.document)),
        vscode.workspace.onDidCloseTextDocument((document) => onDidCloseTextDocument(document)),
        vscode.window.onDidChangeActiveTextEditor(() => onDidChangeActiveTextEditor()),
        //vscode.window.onDidChangeTextEditorSelection(() => onDidChangeTextEditorSelection()),
        //vscode.window.onDidChangeTextEditorVisibleRanges(() => onDidChangeTextEditorVisibleRanges()),
        //vscode.window.onDidChangeActiveColorTheme(() => onDidChangeActiveColorTheme());
        //vscode.window.onDidChangeVisibleTextEditors(textEditers => onDidChangeVisibleTextEditors(textEditers)),
    );
    updateAllDecoration();
};
export const deactivate = () => {};
