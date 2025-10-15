import { PermissionService } from '../src/services/PermissionService';
import { app } from '../src/config/firebase';

(async () => {
  try {
    // Initialize PermissionService (fetches or creates permissions doc)
    const service = PermissionService.getInstance();
    await service.initialize();
    await service.resetToDefaults();
    console.log('Permissions have been reset to defaults in Firestore!');
    process.exit(0);
  } catch (err) {
    console.error('Failed to reset permissions:', err);
    process.exit(1);
  }
})(); 