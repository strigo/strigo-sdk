import { Logger } from '../../services/logger';
import { clearStorage, getStorageData, setStorageValue, setupStorage } from '../storage-utils/storage-utils';
import { STORAGE_NAMES, STORAGE_TYPES } from '../storage-utils/storage-utils.types';

import { StrigoConfig, StrigoProtectedConfig, StrigoToken } from './config.types';

export function init(): StrigoConfig {
  // Get the state from local storage
  const config = getStorageData(STORAGE_TYPES.LOCAL_STORAGE, STORAGE_NAMES.STRIGO_CONFIG);

  return config as StrigoConfig;
}

export function setup(initialConfig: StrigoConfig): StrigoConfig {
  const config = setupStorage<StrigoConfig>(STORAGE_TYPES.LOCAL_STORAGE, STORAGE_NAMES.STRIGO_CONFIG, initialConfig);

  return config;
}

export function getConfig(): StrigoConfig {
  const config = getStorageData(STORAGE_TYPES.LOCAL_STORAGE, STORAGE_NAMES.STRIGO_CONFIG);

  return config as StrigoConfig;
}

export function setConfigValue(key: string, value: any): StrigoConfig {
  const config = setStorageValue(STORAGE_TYPES.LOCAL_STORAGE, STORAGE_NAMES.STRIGO_CONFIG, key, value);

  return config as StrigoConfig;
}

export function clearConfig(): void {
  clearStorage(STORAGE_TYPES.LOCAL_STORAGE, STORAGE_NAMES.STRIGO_CONFIG);
}

export async function fetchRemoteConfiguration(
  token: StrigoToken,
  development: boolean
): Promise<StrigoProtectedConfig | null> {
  try {
    const configDomain = development ? 'http://localhost:3000' : 'https://app.strigo.io';
    const response = await fetch(`${configDomain}/api/internal/academy/v1/config`, {
      method: 'GET',
      headers: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token.token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch remote configuration: ${response.statusText}`);
    }

    const configuration = await response.json();

    return configuration.data;
  } catch (err) {
    Logger.warn('Error fetching configuration from Strigo', { err });

    return null;
  }
}
