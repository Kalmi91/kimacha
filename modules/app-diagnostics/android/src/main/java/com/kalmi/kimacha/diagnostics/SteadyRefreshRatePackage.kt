package com.kalmi.kimacha.diagnostics

import android.app.Activity
import android.content.Context
import android.os.Build
import android.os.Bundle
import android.view.Display
import expo.modules.core.BasePackage
import expo.modules.core.interfaces.ReactActivityLifecycleListener

// Phone, 11-25 (Nokia X30, 60/90 Hz): while a card sat still the screen dropped to 60 Hz and went back to 90 Hz a few
// seconds later; the panel's shade moves with the rate, so the dark background flashed lighter, then darker. The window
// asks for the screen's highest rate at the current resolution on every start and resume, so the rate stays put while
// Kimacha is in front.
class SteadyRefreshRatePackage : BasePackage() {
  override fun createReactActivityLifecycleListeners(activityContext: Context?): List<ReactActivityLifecycleListener> =
    listOf(object : ReactActivityLifecycleListener {
      override fun onCreate(activity: Activity?, savedInstanceState: Bundle?) {
        activity?.let(::holdHighestRefreshRate)
      }

      override fun onResume(activity: Activity?) {
        activity?.let(::holdHighestRefreshRate)
      }
    })
}

private fun holdHighestRefreshRate(activity: Activity) {
  runCatching {
    val window = activity.window ?: return
    val display: Display = (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) activity.display else null)
      ?: @Suppress("DEPRECATION") activity.windowManager.defaultDisplay
      ?: return
    val current = display.mode
    val best = display.supportedModes
      .filter { it.physicalWidth == current.physicalWidth && it.physicalHeight == current.physicalHeight }
      .maxByOrNull { it.refreshRate }
      ?: return
    val params = window.attributes
    if (params.preferredDisplayModeId == best.modeId && params.preferredRefreshRate == best.refreshRate) return
    params.preferredDisplayModeId = best.modeId
    params.preferredRefreshRate = best.refreshRate
    window.attributes = params
  }
}
