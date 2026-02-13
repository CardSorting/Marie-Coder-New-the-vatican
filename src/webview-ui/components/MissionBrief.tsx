import { useState } from "react"

export function MissionBrief({
    brief,
    onSave,
}: {
    brief: string
    onSave: (brief: string) => void
}) {
    const [draft, setDraft] = useState(brief)
    const [isEditing, setIsEditing] = useState(false)

    const handleSave = () => {
        onSave(draft)
        setIsEditing(false)
    }

    return (
        <section className="mission-brief" aria-label="Mission brief">
            <div className="mission-header">
                <div>
                    <div className="mission-title">Mission brief</div>
                    <div className="mission-subtitle">A guiding summary for the session.</div>
                </div>
                <div className="mission-actions">
                    {isEditing ? (
                        <>
                            <button className="secondary" type="button" onClick={() => setIsEditing(false)}>
                                Cancel
                            </button>
                            <button type="button" onClick={handleSave}>
                                Save
                            </button>
                        </>
                    ) : (
                        <button className="secondary" type="button" onClick={() => setIsEditing(true)}>
                            Edit brief
                        </button>
                    )}
                </div>
            </div>
            {isEditing ? (
                <textarea
                    className="mission-input"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    rows={3}
                />
            ) : (
                <div className="mission-text">{brief}</div>
            )}
        </section>
    )
}