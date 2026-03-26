import AppKit
import CoreGraphics
import Foundation

struct BrandPalette {
  let background = NSColor(calibratedRed: 0.94, green: 0.96, blue: 1.0, alpha: 1.0)
  let backgroundAlt = NSColor(calibratedRed: 0.90, green: 0.94, blue: 1.0, alpha: 1.0)
  let primary = NSColor(calibratedRed: 0.42, green: 0.36, blue: 0.91, alpha: 1.0)
  let primaryDark = NSColor(calibratedRed: 0.29, green: 0.25, blue: 0.81, alpha: 1.0)
  let highlight = NSColor(calibratedRed: 0.51, green: 0.63, blue: 1.0, alpha: 1.0)
  let monochrome = NSColor(calibratedWhite: 0.62, alpha: 1.0)
}

let palette = BrandPalette()
let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let assets = root.appendingPathComponent("assets", isDirectory: true)

enum AssetVariant {
  case appIcon
  case splash
  case adaptiveForeground
  case adaptiveMonochrome
  case adaptiveBackground
  case favicon
}

func roundedRect(_ rect: CGRect, radius: CGFloat) -> NSBezierPath {
  return NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
}

func fill(_ path: NSBezierPath, color: NSColor) {
  color.setFill()
  path.fill()
}

func stroke(_ path: NSBezierPath, color: NSColor, width: CGFloat) {
  color.setStroke()
  path.lineWidth = width
  path.stroke()
}

func drawGradientBackground(in rect: CGRect) {
  let gradient = NSGradient(
    colors: [
      palette.backgroundAlt,
      palette.background,
      NSColor.white,
    ]
  )

  gradient?.draw(in: NSBezierPath(roundedRect: rect, xRadius: rect.width * 0.14, yRadius: rect.width * 0.14), angle: -90)

  let orbRect = CGRect(
    x: rect.midX - rect.width * 0.30,
    y: rect.midY - rect.height * 0.18,
    width: rect.width * 0.60,
    height: rect.width * 0.60
  )
  let orbPath = NSBezierPath(ovalIn: orbRect)
  NSColor(calibratedRed: 0.53, green: 0.67, blue: 1.0, alpha: 0.12).setFill()
  orbPath.fill()
}

func drawFGlyph(in rect: CGRect, monochrome: Bool = false, transparent: Bool = false) {
  let inset = rect.width * (transparent ? 0.24 : 0.22)
  let glyphRect = rect.insetBy(dx: inset, dy: inset)

  let stemWidth = glyphRect.width * 0.24
  let topBarHeight = glyphRect.height * 0.18
  let midBarHeight = glyphRect.height * 0.16
  let stemRect = CGRect(x: glyphRect.minX, y: glyphRect.minY, width: stemWidth, height: glyphRect.height)
  let topRect = CGRect(
    x: glyphRect.minX,
    y: glyphRect.maxY - topBarHeight,
    width: glyphRect.width,
    height: topBarHeight
  )
  let midRect = CGRect(
    x: glyphRect.minX,
    y: glyphRect.midY - midBarHeight * 0.25,
    width: glyphRect.width * 0.74,
    height: midBarHeight
  )

  let stemPath = roundedRect(stemRect, radius: stemWidth * 0.48)
  let topPath = roundedRect(topRect, radius: topBarHeight * 0.50)
  let midPath = roundedRect(midRect, radius: midBarHeight * 0.50)

  if monochrome {
    fill(stemPath, color: palette.monochrome)
    fill(topPath, color: palette.monochrome)
    fill(midPath, color: palette.monochrome)
    return
  }

  if !transparent {
    let glowRect = glyphRect.insetBy(dx: -rect.width * 0.05, dy: -rect.width * 0.05)
    let glowPath = NSBezierPath(ovalIn: glowRect)
    NSColor(calibratedRed: 0.42, green: 0.36, blue: 0.91, alpha: 0.10).setFill()
    glowPath.fill()
  }

  fill(stemPath, color: palette.primaryDark)
  fill(topPath, color: palette.primary)
  fill(midPath, color: palette.highlight)

  let accentWidth = stemWidth * 0.24
  let accentRect = CGRect(
    x: glyphRect.minX + stemWidth * 0.24,
    y: glyphRect.minY + glyphRect.height * 0.12,
    width: accentWidth,
    height: glyphRect.height * 0.56
  )
  let accentPath = roundedRect(accentRect, radius: accentWidth * 0.5)
  NSColor(calibratedRed: 1.0, green: 1.0, blue: 1.0, alpha: transparent ? 0.18 : 0.22).setFill()
  accentPath.fill()
}

func drawAdaptiveBackground(in rect: CGRect) {
  let gradient = NSGradient(
    colors: [
      NSColor(calibratedRed: 0.94, green: 0.97, blue: 1.0, alpha: 1.0),
      NSColor(calibratedRed: 0.89, green: 0.94, blue: 1.0, alpha: 1.0),
    ]
  )
  gradient?.draw(in: NSBezierPath(rect: rect), angle: -90)

  let circle = NSBezierPath(ovalIn: rect.insetBy(dx: rect.width * 0.18, dy: rect.height * 0.18))
  NSColor(calibratedRed: 0.51, green: 0.63, blue: 1.0, alpha: 0.11).setFill()
  circle.fill()
}

func renderPNG(
  size: Int,
  scale: CGFloat = 1,
  transparent: Bool = false,
  draw: (CGRect) -> Void
) -> Data? {
  let pixelSize = CGSize(width: CGFloat(size), height: CGFloat(size))
  let image = NSImage(size: pixelSize)
  image.lockFocusFlipped(false)

  if !transparent {
    NSColor.clear.set()
    NSBezierPath(rect: CGRect(origin: .zero, size: pixelSize)).fill()
  }

  draw(CGRect(origin: .zero, size: pixelSize))
  image.unlockFocus()

  guard let tiff = image.tiffRepresentation,
        let bitmap = NSBitmapImageRep(data: tiff)
  else {
    return nil
  }

  bitmap.size = pixelSize
  return bitmap.representation(using: .png, properties: [:])
}

func writeAsset(_ name: String, size: Int, variant: AssetVariant) throws {
  let output = assets.appendingPathComponent(name)

  let data: Data?
  switch variant {
  case .appIcon:
    data = renderPNG(size: size) { rect in
      drawGradientBackground(in: rect)
      drawFGlyph(in: rect)
    }
  case .splash:
    data = renderPNG(size: size, transparent: true) { rect in
      drawFGlyph(in: rect.insetBy(dx: rect.width * 0.08, dy: rect.height * 0.08), transparent: true)
    }
  case .adaptiveForeground:
    data = renderPNG(size: size, transparent: true) { rect in
      drawFGlyph(in: rect, transparent: true)
    }
  case .adaptiveMonochrome:
    data = renderPNG(size: size, transparent: true) { rect in
      drawFGlyph(in: rect, monochrome: true, transparent: true)
    }
  case .adaptiveBackground:
    data = renderPNG(size: size) { rect in
      drawAdaptiveBackground(in: rect)
    }
  case .favicon:
    data = renderPNG(size: size) { rect in
      drawGradientBackground(in: rect)
      drawFGlyph(in: rect)
    }
  }

  guard let data else {
    throw NSError(domain: "brand-assets", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to render \(name)"])
  }

  try data.write(to: output)
  print("wrote \(output.path)")
}

do {
  try writeAsset("icon.png", size: 1024, variant: .appIcon)
  try writeAsset("splash-icon.png", size: 1024, variant: .splash)
  try writeAsset("android-icon-foreground.png", size: 512, variant: .adaptiveForeground)
  try writeAsset("android-icon-monochrome.png", size: 432, variant: .adaptiveMonochrome)
  try writeAsset("android-icon-background.png", size: 512, variant: .adaptiveBackground)
  try writeAsset("favicon.png", size: 48, variant: .favicon)
} catch {
  fputs("Failed to generate brand assets: \(error.localizedDescription)\n", stderr)
  exit(1)
}
