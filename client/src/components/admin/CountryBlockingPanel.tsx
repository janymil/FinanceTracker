import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, Plus, Shield, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { queryClient } from "@/lib/queryClient";

interface BlockedCountry {
  id: number;
  countryCode: string;
  countryName: string;
  reason: string | null;
  blockedAt: string;
  blockedBy: string | null;
}

interface CountryCode {
  code: string;
  name: string;
}

const adminFetch = async (url: string, options?: RequestInit) => {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
};

export function CountryBlockingPanel() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const { toast } = useToast();

  // Fetch blocked countries
  const { data: blockedCountries = [], isLoading: blockedLoading, refetch: refetchBlocked } = useQuery({
    queryKey: ['admin-blocked-countries'],
    queryFn: () => adminFetch('/api/admin-analytics/blocked-countries'),
    select: (data) => data.countries as BlockedCountry[],
  });

  // Fetch country codes
  const { data: countryCodes = [], isLoading: codesLoading } = useQuery({
    queryKey: ['admin-country-codes'],
    queryFn: () => adminFetch('/api/admin-analytics/country-codes'),
    select: (data) => data.countries as CountryCode[],
  });


  // Add blocked country mutation
  const addBlockedCountry = useMutation({
    mutationFn: async (data: { countryCode: string; countryName: string; reason?: string }) => {
      return adminFetch('/api/admin-analytics/blocked-countries', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Country has been blocked",
      });
      setShowAddDialog(false);
      setSelectedCountry("");
      setBlockReason("");
      refetchBlocked();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Remove blocked country mutation
  const removeBlockedCountry = useMutation({
    mutationFn: async (countryCode: string) => {
      return adminFetch(`/api/admin-analytics/blocked-countries/${countryCode}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Country has been unblocked",
      });
      refetchBlocked();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddCountry = () => {
    const country = countryCodes.find(c => c.code === selectedCountry);
    if (!country) return;

    addBlockedCountry.mutate({
      countryCode: country.code,
      countryName: country.name,
      reason: blockReason || undefined,
    });
  };

  // Filter out already blocked countries from the selection
  const availableCountries = countryCodes.filter(
    country => !blockedCountries.some(blocked => blocked.countryCode === country.code)
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Country Access Control
            </CardTitle>
            <CardDescription>
              Manage which countries can access your application
            </CardDescription>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Block Country
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Block Country Access</DialogTitle>
                <DialogDescription>
                  Select a country to block from accessing the application
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a country" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCountries.map((country) => (
                        <SelectItem key={country.code} value={country.code}>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs">{country.code}</span>
                            <span>{country.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Reason (Optional)</Label>
                  <Textarea
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    placeholder="Enter reason for blocking this country..."
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddCountry}
                  disabled={!selectedCountry || addBlockedCountry.isPending}
                >
                  Block Country
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {blockedLoading || codesLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : blockedCountries.length === 0 ? (
          <div className="text-center py-12">
            <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No countries are currently blocked</p>
            <p className="text-sm text-gray-400 mt-2">
              All countries have access to the application
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Country</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Blocked Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blockedCountries.map((country) => (
                  <TableRow key={country.id}>
                    <TableCell className="font-medium">{country.countryName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono">
                        {country.countryCode}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {country.reason || '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(country.blockedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Unblock {country.countryName}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will allow users from {country.countryName} to access the application again.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => removeBlockedCountry.mutate(country.countryCode)}
                            >
                              Unblock
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        
        <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> Country blocking uses GeoJS free service for IP geolocation. 
            Users with VPNs or proxies may bypass these restrictions.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}