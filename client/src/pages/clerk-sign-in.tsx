
import { SignIn } from "@clerk/clerk-react";

export default function ClerkSignInPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <SignIn 
          routing="path"
          path="/sign-in-clerk"
          fallbackRedirectUrl="/"
          signUpUrl="/sign-up-clerk"
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "shadow-lg border-0",
            }
          }}
        />
      </div>
    </div>
  );
}
