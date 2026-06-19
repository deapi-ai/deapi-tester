import { NextResponse } from 'next/server';
import {
  loadFullConfig,
  saveFullConfig,
  setActiveProfile,
  addProfile,
  updateProfile,
  deleteProfile,
} from '@/lib/config';
import { AppConfigFull, ConfigProfile } from '@/lib/types';

// Mask token for response
function maskToken(token: string): string {
  if (!token) return '';
  return '***' + token.slice(-4);
}

// Mask all tokens in profiles
function maskProfiles(profiles: ConfigProfile[]): (Omit<ConfigProfile, 'apiToken'> & { apiToken: string; hasToken: boolean })[] {
  return profiles.map(p => ({
    ...p,
    apiToken: maskToken(p.apiToken),
    hasToken: !!p.apiToken,
  }));
}

// GET /api/config - Load current configuration with all profiles
export async function GET() {
  try {
    const config = loadFullConfig();

    // Mask tokens
    const maskedConfig = {
      ...config,
      profiles: maskProfiles(config.profiles),
    };

    return NextResponse.json(maskedConfig);
  } catch (error) {
    console.error('[deapi-tester] GET /api/config error:', error);
    return NextResponse.json(
      { error: 'Failed to load configuration' },
      { status: 500 }
    );
  }
}

// PUT /api/config - Update configuration or perform profile operations
export async function PUT(request: Request) {
  try {
    const body = await request.json();

    // Profile operations
    if (body.action) {
      switch (body.action) {
        case 'setActiveProfile': {
          if (!body.profileId || typeof body.profileId !== 'string') {
            return NextResponse.json(
              { error: 'profileId is required' },
              { status: 400 }
            );
          }
          const config = setActiveProfile(body.profileId);
          return NextResponse.json({
            ...config,
            profiles: maskProfiles(config.profiles),
          });
        }

        case 'addProfile': {
          if (!body.profile || typeof body.profile !== 'object') {
            return NextResponse.json(
              { error: 'profile object is required' },
              { status: 400 }
            );
          }
          const { name, apiUrl, apiToken } = body.profile;
          if (!name || typeof name !== 'string') {
            return NextResponse.json(
              { error: 'profile.name is required' },
              { status: 400 }
            );
          }
          const newProfile = addProfile({
            name,
            apiUrl: apiUrl || 'https://api.deapi.ai/api/v2',
            apiToken: apiToken || '',
          });
          const config = loadFullConfig();
          return NextResponse.json({
            profile: {
              ...newProfile,
              apiToken: maskToken(newProfile.apiToken),
              hasToken: !!newProfile.apiToken,
            },
            config: {
              ...config,
              profiles: maskProfiles(config.profiles),
            },
          });
        }

        case 'updateProfile': {
          if (!body.profileId || typeof body.profileId !== 'string') {
            return NextResponse.json(
              { error: 'profileId is required' },
              { status: 400 }
            );
          }
          if (!body.updates || typeof body.updates !== 'object') {
            return NextResponse.json(
              { error: 'updates object is required' },
              { status: 400 }
            );
          }
          const updated = updateProfile(body.profileId, body.updates);
          const config = loadFullConfig();
          return NextResponse.json({
            profile: {
              ...updated,
              apiToken: maskToken(updated.apiToken),
              hasToken: !!updated.apiToken,
            },
            config: {
              ...config,
              profiles: maskProfiles(config.profiles),
            },
          });
        }

        case 'deleteProfile': {
          if (!body.profileId || typeof body.profileId !== 'string') {
            return NextResponse.json(
              { error: 'profileId is required' },
              { status: 400 }
            );
          }
          const config = deleteProfile(body.profileId);
          return NextResponse.json({
            ...config,
            profiles: maskProfiles(config.profiles),
          });
        }

        default:
          return NextResponse.json(
            { error: `Unknown action: ${body.action}` },
            { status: 400 }
          );
      }
    }

    // Regular config update (global settings)
    const config = loadFullConfig();

    // Update global settings
    if (body.outputDir !== undefined) {
      if (typeof body.outputDir !== 'string') {
        return NextResponse.json(
          { error: 'outputDir must be a string' },
          { status: 400 }
        );
      }
      config.outputDir = body.outputDir;
    }

    if (body.pollingIntervalMs !== undefined) {
      if (typeof body.pollingIntervalMs !== 'number') {
        return NextResponse.json(
          { error: 'pollingIntervalMs must be a number' },
          { status: 400 }
        );
      }
      config.pollingIntervalMs = body.pollingIntervalMs;
    }

    if (body.maxPollingAttempts !== undefined) {
      if (typeof body.maxPollingAttempts !== 'number') {
        return NextResponse.json(
          { error: 'maxPollingAttempts must be a number' },
          { status: 400 }
        );
      }
      config.maxPollingAttempts = body.maxPollingAttempts;
    }

    // Backward compatibility: if apiUrl/apiToken sent, update active profile
    const activeProfile = config.profiles.find(p => p.id === config.activeProfileId);
    if (activeProfile) {
      if (body.apiUrl !== undefined) {
        if (typeof body.apiUrl !== 'string') {
          return NextResponse.json(
            { error: 'apiUrl must be a string' },
            { status: 400 }
          );
        }
        activeProfile.apiUrl = body.apiUrl;
      }

      if (body.apiToken !== undefined) {
        if (typeof body.apiToken !== 'string') {
          return NextResponse.json(
            { error: 'apiToken must be a string' },
            { status: 400 }
          );
        }
        activeProfile.apiToken = body.apiToken;
      }
    }

    const newConfig = saveFullConfig(config);

    return NextResponse.json({
      ...newConfig,
      profiles: maskProfiles(newConfig.profiles),
    });
  } catch (error) {
    console.error('[deapi-tester] PUT /api/config error:', error);
    const message = error instanceof Error ? error.message : 'Failed to save configuration';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
