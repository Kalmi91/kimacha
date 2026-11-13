package com.kalmi.kimacha.diagnostics

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AppDiagnosticsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AppDiagnostics")

    AsyncFunction("getProcessExitReasons") { sinceMs: Long ->
      getProcessExitReasons(sinceMs)
    }
  }

  private fun getProcessExitReasons(sinceMs: Long): List<Map<String, Any?>> {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return emptyList()
    val context = appContext.reactContext ?: return emptyList()
    val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    // Only our own package. No usage-access permission or other apps' history.
    return manager.getHistoricalProcessExitReasons(context.packageName, 0, 10)
      .filter { it.timestamp > sinceMs }
      .map {
        mapOf(
          "timestamp" to it.timestamp,
          "reason" to it.reason,
          "description" to it.description?.take(2000),
          "pssKb" to it.pss,
          "rssKb" to it.rss
        )
      }
  }
}
