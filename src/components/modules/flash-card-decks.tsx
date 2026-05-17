import { cn } from '@/lib/utils';
import React, { useState } from 'react'
import { Card } from '../ui/card';
import { Badge } from 'lucide-react';
import { Button } from '../ui/button';

function FlashcardDeck({ flashcards }: { flashcards: Array<{ id: string; front: string; back: string }> }) {
    const [currentIndex, setCurrentIndex] = useState(0)
    const [isFlipped, setIsFlipped] = useState(false)

    const currentCard = flashcards[currentIndex]

    const nextCard = () => {
        setIsFlipped(false)
        setCurrentIndex((prev) => (prev + 1) % flashcards.length)
    }

    const prevCard = () => {
        setIsFlipped(false)
        setCurrentIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length)
    }

    if (flashcards.length === 0) return null

    return (
        <div className="space-y-4">
            <div className="text-center text-sm text-muted-foreground">
                Card {currentIndex + 1} of {flashcards.length}
            </div>

            <div
                className="relative cursor-pointer perspective-1000"
                onClick={() => setIsFlipped(!isFlipped)}
            >
                <div className={cn(
                    "relative w-full min-h-[300px] transition-transform duration-500 transform-style-3d",
                    isFlipped && "rotate-y-180"
                )}>
                    {/* Front */}
                    <div className="absolute inset-0 backface-hidden">
                        <Card className="h-full flex items-center justify-center p-8 hover:shadow-lg transition-shadow">
                            <div className="text-center">
                                <Badge className="mb-4">Front</Badge>
                                <p className="text-lg">{currentCard.front}</p>
                                <p className="text-sm text-muted-foreground mt-4">Click to flip</p>
                            </div>
                        </Card>
                    </div>

                    {/* Back */}
                    <div className="absolute inset-0 backface-hidden rotate-y-180">
                        <Card className="h-full flex items-center justify-center p-8 bg-primary/5 hover:shadow-lg transition-shadow">
                            <div className="text-center">
                                <Badge className="mb-4">Back</Badge>
                                <p className="text-lg">{currentCard.back}</p>
                                <p className="text-sm text-muted-foreground mt-4">Click to flip back</p>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>

            <div className="flex justify-between gap-4">
                <Button onClick={prevCard} variant="default" className="flex-1">
                    Previous
                </Button>
                <Button onClick={nextCard} className="flex-1">
                    Next Card
                </Button>
            </div>
        </div>
    )
}
export default FlashcardDeck