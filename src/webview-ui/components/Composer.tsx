import { useEffect, useRef, useState } from "react"

export function Composer({
    isLoading,
    onSend,
}: {
    isLoading: boolean
    onSend: (text: string) => void
}) {
    const [input, setInput] = useState("")
    const [showThinking, setShowThinking] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement | null>(null)

    useEffect(() => {
        const textarea = textareaRef.current
        if (!textarea) return

        textarea.style.height = "auto"
        const nextHeight = Math.min(textarea.scrollHeight, 220)
        textarea.style.height = `${Math.max(52, nextHeight)}px`
    }, [input])

    useEffect(() => {
        if (!isLoading) {
            setShowThinking(false)
            return
        }

        const timer = window.setTimeout(() => setShowThinking(true), 1200)
        return () => window.clearTimeout(timer)
    }, [isLoading])

    const submit = () => {
        const text = input.trim()
        if (!text) return
        setInput("")
        onSend(text)
    }

    return (
        <footer className="composer-container">
            <div className="composer-box">
                <textarea
                    ref={textareaRef}
                    className="textarea-minimal"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                            e.preventDefault()
                            submit()
                            return
                        }

                        if (e.key === "Enter" && e.shiftKey) {
                            return
                        }

                        if (e.key === "Enter") {
                            e.preventDefault()
                            submit()
                        }
                    }}
                    placeholder="Ask Marie…"
                />

                <div className="composer-actions">
                    <div className="composer-status">
                        {showThinking ? <span className="thinking">Thinking…</span> : <span className="muted">Enter to send</span>}
                    </div>
                    <button onClick={submit} disabled={isLoading}>
                        Send
                    </button>
                </div>
            </div>
        </footer>
    )
}
