import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"

export default function FlashcardsPage() {
  return (
    <>
      <Header title="Flashcards" subtitle="Review decks from your topics" />
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No flashcard decks yet.
        </CardContent>
      </Card>
    </>
  )
}
