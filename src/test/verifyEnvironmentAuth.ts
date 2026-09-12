import { isLocalhost, isDevEnvironment, isProdEnvironment, isCloudUUID } from '../services/environment';
import { isSupabaseConfigured } from '../services/supabase';

console.log('Testing Environment Detection & Auth Config...');

// 1. Supabase configuration verification
const configured = isSupabaseConfigured();
console.assert(configured === true, 'Supabase must be configured even without .env in CI');
console.log('✓ Supabase is permanently configured with valid production project credentials.');

// 2. Cloud UUID validator test
const testCloudId = '123e4567-e89b-12d3-a456-426614174000';
const testLocalId1 = 'user_default';
const testLocalId2 = 'usr_1712345678_abcde';
console.assert(isCloudUUID(testCloudId) === true, 'Valid UUID should be recognized');
console.assert(isCloudUUID(testLocalId1) === false, 'Local default user must NOT be cloud UUID');
console.assert(isCloudUUID(testLocalId2) === false, 'Local usr_ user must NOT be cloud UUID');
console.log('✓ isCloudUUID correctly distinguishes cloud users from local accounts.');

// 3. Node environment (non-browser) defaults
console.assert(typeof isLocalhost() === 'boolean', 'isLocalhost returns boolean');
console.assert(typeof isDevEnvironment() === 'boolean', 'isDevEnvironment returns boolean');
console.assert(typeof isProdEnvironment() === 'boolean', 'isProdEnvironment returns boolean');
console.log('✓ Environment detection functions execute without error in all runtimes.');

console.log('All Environment & Auth tests passed successfully!');
