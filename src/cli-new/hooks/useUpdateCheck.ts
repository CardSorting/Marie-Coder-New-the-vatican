import { useState, useEffect } from "react";
import { UpdateService, UpdateInfo } from "../../monolith/services/UpdateService.js";

const CURRENT_VERSION = "0.1.16"; // This should be updated by a build script or read from package.json

export function useUpdateCheck() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    async function check() {
      const info = await UpdateService.checkUpdate(CURRENT_VERSION);
      if (info?.isUpdateAvailable) {
        setUpdateInfo(info);
      }
    }

    check();
  }, []);

  return updateInfo;
}
