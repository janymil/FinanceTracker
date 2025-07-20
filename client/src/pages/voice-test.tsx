import React from 'react';
import { SEO } from '@/components/SEO';
import { SeamlessVoiceInput } from '@/components/seamless-voice-input';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function VoiceTestPage() {
  const { t } = useTranslation();

  return (
    <>
      <SEO 
        title="Voice Test - Seamless Voice Input | FinanzerPro"
        description="Test the seamless voice input system for transaction creation"
      />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Seamless Voice Input Test
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Test the ChatGPT-like voice experience for transaction input
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>How it works</CardTitle>
            <CardDescription>
              This is a pure voice-to-voice conversation system:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Click "Start Voice Input" and speak your transaction</li>
              <li>The system will ask questions for any missing information</li>
              <li>Answer the questions verbally - no typing needed</li>
              <li>The transaction will be saved automatically when complete</li>
              <li>No visible text or transcription - pure voice interaction</li>
            </ol>
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Example:</strong> Say "I spent twenty dollars at Starbucks for coffee"
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Voice Input</CardTitle>
            <CardDescription>
              Click the button and start speaking about your transaction
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SeamlessVoiceInput
              onComplete={(transaction) => {
                console.log('Transaction completed:', transaction);
              }}
              className="flex justify-center"
            />
          </CardContent>
        </Card>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Debug Info</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Check browser console for detailed logs during voice interaction.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}