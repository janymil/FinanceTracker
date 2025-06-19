export default function TestPublic() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">Test Public Page</h1>
        <p className="text-lg text-muted-foreground mb-8">
          This is a test page to verify routing works without 404 errors below content.
        </p>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-4">Content Section</h2>
          <p className="text-gray-600 dark:text-gray-300">
            If you see a "404 Page Not Found" error below this content, 
            the routing issue still exists. If not, the fix worked.
          </p>
        </div>
      </div>
    </div>
  );
}