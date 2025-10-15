import React from 'react';
import { Link } from 'react-router-dom';
import { VITAsset } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface VITAssetListProps {
  assets: VITAsset[];
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
}

export function VITAssetList({ assets, onLoadMore, hasMore, isLoading }: VITAssetListProps) {
  if (assets.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No assets found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {assets.map((asset) => (
          <Link to={`/asset-management/vit-inspection-details/${asset.id}`} key={asset.id}>
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>{asset.typeOfUnit}</span>
                  <Badge variant={asset.status === 'Operational' ? 'default' : 'secondary'}>
                    {asset.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p><strong>Voltage Level:</strong> {asset.voltageLevel}</p>
                  <p><strong>Serial Number:</strong> {asset.serialNumber}</p>
                  <p><strong>Location:</strong> {asset.location}</p>
                  <p><strong>Protection:</strong> {asset.protection}</p>
                  <p><strong>Last Updated:</strong> {format(new Date(asset.updatedAt), 'MMM d, yyyy')}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center mt-4">
          <Button
            onClick={onLoadMore}
            disabled={isLoading}
            className="w-48"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </Button>
        </div>
      )}
    </div>
  );
} 