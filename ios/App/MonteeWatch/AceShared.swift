import SwiftUI

// 4.7 : Ace partagé entre l'app montre et les complications (avant : dans Views.swift).
// MARK: - 3.81 : Ace (la Balle) au poignet : même dessin et mêmes mouvements que sur l'iPhone (web/balle.js)

/// Une pose d'Ace (repère 200 × 220 du dessin de l'iPhone)
struct AcePose {
    var y: Double = 0
    var sx: Double = 1
    var sy: Double = 1
    var fx: Double = 0
    var fy: Double = 0
    var open: Double = 1
    var happy: Double = 0
    var lx: Double = 0
    var ly: Double = 0
    var brow: Double = 0
    var browA: Double = 0
    var smile: Double = 22
    var band: Double = 0
    var dots: Double = 0
    var spark: Double = 0
    var tilt: Double = 0
}

/// Les humeurs d'Ace : pose à l'instant u (0 → 1)
enum AceMoves {
    static func cl(_ x: Double) -> Double { return max(0, min(1, x)) }
    static func seg(_ u: Double, _ a: Double, _ b: Double) -> Double { return cl((u - a) / (b - a)) }
    static func eo(_ t: Double) -> Double { return 1 - pow(1 - t, 3) }
    static func eio(_ t: Double) -> Double {
        if t < 0.5 { return 4 * t * t * t }
        return 1 - pow(-2 * t + 2, 3) / 2
    }
    static func bump(_ t: Double) -> Double { return sin(Double.pi * cl(t)) }
    static func blink(_ u: Double, _ at: Double) -> Double {
        let k = abs(u - at) / 0.06
        return k < 1 ? k : 1
    }

    /// Où s'arrête l'humeur (pose gardée ensuite)
    static func end(_ m: String) -> Double {
        if m == "joie" || m == "fier" || m == "rire" || m == "rebond" || m == "surpris" || m == "parle" { return 1 }
        if m == "repos" { return 0 }
        if m == "reflexion" { return 0.5 }
        return 0.55
    }

    static func pose(_ m: String, _ u: Double) -> AcePose {
        switch m {
        case "joie": return joie(u)
        case "decue": return decue(u)
        case "reflexion": return reflexion(u)
        case "concentree": return concentree(u)
        case "parle": return parle(u)
        case "surpris": return surpris(u)
        case "fier": return fier(u)
        case "rebond": return rebond(u)
        case "rire": return rire(u)
        default: return repos(u)
        }
    }

    static func repos(_ u: Double) -> AcePose {
        var p = AcePose()
        let br = sin(u * Double.pi * 4) * 0.012
        var g: Double = 0
        if u < 0.3 { g = 0 }
        else if u < 0.5 { g = eio(seg(u, 0.3, 0.42)) * -5 }
        else if u < 0.75 { g = -5 + eio(seg(u, 0.5, 0.62)) * 10 }
        else { g = 5 - eio(seg(u, 0.75, 0.87)) * 5 }
        p.sy = 1 + br
        p.sx = 1 - br * 0.6
        p.open = min(blink(u, 0.2), blink(u, 0.9))
        p.lx = g
        p.fx = g * 0.5
        return p
    }

    static func joie(_ u: Double) -> AcePose {
        var p = AcePose()
        let happy = u > 0.9 ? 1 : eo(seg(u, 0.05, 0.2))
        if u < 0.18 {
            let t = eo(seg(u, 0, 0.18)); p.sy = 1 - 0.14 * t; p.sx = 1 + 0.1 * t
        } else if u < 0.52 {
            let t = seg(u, 0.18, 0.52); let b = (1 - t) * bump(t * 2)
            p.y = -120 * 4 * t * (1 - t); p.sy = 1 + 0.14 * b; p.sx = 1 - 0.09 * b
        } else if u < 0.6 {
            let t = bump(seg(u, 0.52, 0.6)); p.sy = 1 - 0.18 * t; p.sx = 1 + 0.13 * t
        } else if u < 0.78 {
            let t = seg(u, 0.6, 0.78); p.y = -30 * 4 * t * (1 - t)
        } else if u < 0.84 {
            let t = bump(seg(u, 0.78, 0.84)); p.sy = 1 - 0.06 * t; p.sx = 1 + 0.04 * t
        }
        p.happy = happy
        p.smile = 22 + 14 * happy
        p.spark = (u > 0.3 && u < 0.9) ? bump(seg(u, 0.3, 0.9)) : 0
        p.tilt = sin(u * Double.pi * 3) * 3 * (1 - u)
        return p
    }

    static func decue(_ u: Double) -> AcePose {
        var p = AcePose()
        let down = eio(seg(u, 0.05, 0.35)) * (1 - eio(seg(u, 0.7, 0.95)))
        p.sy = 1 - 0.07 * down
        p.sx = 1 + 0.05 * down
        p.fy = 9 * down
        p.open = 1 - 0.45 * down
        p.ly = 4 * down
        p.brow = -1
        p.browA = down
        p.smile = 22 - 17 * down
        p.tilt = -3 * down + sin(seg(u, 0.72, 0.95) * Double.pi) * 2
        return p
    }

    static func reflexion(_ u: Double) -> AcePose {
        var p = AcePose()
        let t = eio(seg(u, 0.08, 0.3)) * (1 - eio(seg(u, 0.8, 0.98)))
        p.fx = 16 * t
        p.fy = -8 * t
        p.lx = 5 * t
        p.ly = -6 * t
        p.tilt = 6 * t
        if t > 0.9 { p.dots = cl((u - 0.3) / 0.12) * 3 } else if u > 0.8 { p.dots = 3 * t }
        p.open = blink(u, 0.55)
        return p
    }

    static func concentree(_ u: Double) -> AcePose {
        var p = AcePose()
        let b = eo(seg(u, 0.05, 0.4))
        let lean = eio(seg(u, 0.45, 0.6)) * (1 - eio(seg(u, 0.85, 1)) * 0.5)
        let nod = (u > 0.62 && u < 0.82) ? sin(seg(u, 0.62, 0.82) * Double.pi) : 0
        let f = eo(seg(u, 0.35, 0.5))
        p.band = b
        p.brow = 1
        p.browA = f
        p.fy = 3 * lean + 5 * nod
        p.sy = 1 - 0.03 * lean
        p.sx = 1 + 0.02 * lean
        p.smile = 22 - 8 * f
        p.open = min(1 - 0.15 * f, blink(u, 0.9))
        return p
    }

    // 4.7 : les moments de l'iPhone 4.4 (web/balle.js), mêmes courbes
    static func parle(_ u: Double) -> AcePose {
        var p = AcePose()
        let o = abs(sin(u * 12 * Double.pi))
        p.smile = 22 + 10 * o; p.sy = 1 + 0.02 * o; p.sx = 1 - 0.012 * o; p.y = -2 * o
        p.open = blink(u, 0.62); p.lx = 2
        return p
    }

    static func surpris(_ u: Double) -> AcePose {
        var p = AcePose()
        let t = eo(seg(u, 0, 0.18))
        if u < 0.35 { let k = seg(u, 0, 0.35); p.y = -40 * 4 * k * (1 - k) }
        else if u < 0.42 { let k = bump(seg(u, 0.35, 0.42)); p.sy = 1 - 0.12 * k; p.sx = 1 + 0.08 * k }
        p.smile = 22 - 6 * t; p.ly = -3 * t
        return p
    }

    static func fier(_ u: Double) -> AcePose {
        var p = AcePose()
        let r = eio(seg(u, 0.15, 0.6))
        if u < 0.12 { let k = eo(seg(u, 0, 0.12)); p.sy = 1 - 0.16 * k; p.sx = 1 + 0.12 * k }
        else if u < 0.6 { let k = seg(u, 0.12, 0.6); p.y = -150 * 4 * k * (1 - k) }
        else if u < 0.68 { let k = bump(seg(u, 0.6, 0.68)); p.sy = 1 - 0.2 * k; p.sx = 1 + 0.14 * k }
        p.tilt = 360 * r
        p.happy = eo(seg(u, 0.55, 0.7)); p.smile = 36
        p.spark = u > 0.55 ? bump(seg(u, 0.55, 1)) : 0
        return p
    }

    /// Le retour au combat : il s'écrase, sourcils tristes, puis rebondit et retrouve le sourire
    static func rebond(_ u: Double) -> AcePose {
        var p = AcePose()
        let d = eio(seg(u, 0, 0.3)) * (1 - eio(seg(u, 0.35, 0.55)))
        p.sx = 1 + 0.06 * d; p.sy = 1 - 0.1 * d
        if u > 0.55 && u < 0.85 { let k = seg(u, 0.55, 0.85); p.y = -70 * 4 * k * (1 - k) }
        p.fy = 8 * d; p.open = 1 - 0.4 * d
        p.brow = u < 0.45 ? -1 : 0; p.browA = d
        p.smile = 22 - 14 * d + (u > 0.55 ? 10 * eo(seg(u, 0.55, 0.8)) : 0)
        return p
    }

    static func rire(_ u: Double) -> AcePose {
        var p = AcePose()
        let w = sin(u * Double.pi * 8) * (1 - u)
        p.happy = 1; p.smile = 38; p.tilt = w * 7
        p.sy = 1 - 0.06 * abs(w); p.sx = 1 + 0.04 * abs(w); p.y = -6 * abs(w)
        return p
    }
}

/// Le dessin d'Ace dans un Canvas (formes du SVG de l'iPhone, sans le grain)
enum AceDraw {
    static func rgb(_ r: Double, _ g: Double, _ b: Double) -> Color { return Color(red: r / 255, green: g / 255, blue: b / 255) }

    static func draw(_ ctx: GraphicsContext, _ size: CGSize, _ p: AcePose) {
        var c = ctx
        let k = min(size.width / 200, size.height / 220)
        c.scaleBy(x: k, y: k)
        // Ombre au sol : plus petite quand Ace saute
        let hgt = max(0, -p.y)
        let rx = 56 * p.sx * max(0.45, 1 - hgt / 160)
        let shOp = 0.2 * max(0.3, 1 - hgt / 140)
        c.fill(Path(ellipseIn: CGRect(x: 100 - rx, y: 199, width: rx * 2, height: 14)), with: .color(Color.black.opacity(shOp)))
        dots(c, p)
        sparks(c, p)
        var b = c
        b.translateBy(x: 100, y: 200 + p.y)
        b.rotate(by: .degrees(p.tilt))
        b.scaleBy(x: p.sx, y: p.sy)
        b.translateBy(x: -100, y: -200)
        ball(b, p)
    }

    static func dots(_ c: GraphicsContext, _ p: AcePose) {
        if p.dots <= 0 { return }
        let pts: [(Double, Double, Double)] = [(168, 44, 5), (182, 26, 6), (198, 6, 7)]
        for i in 0..<3 {
            let o = max(0, min(1, p.dots - Double(i)))
            let d = pts[i]
            c.fill(Path(ellipseIn: CGRect(x: d.0 - d.2, y: d.1 - d.2, width: d.2 * 2, height: d.2 * 2)), with: .color(Color.white.opacity(0.85 * o)))
        }
    }

    static func sparks(_ c: GraphicsContext, _ p: AcePose) {
        if p.spark <= 0.02 { return }
        let r1 = 92 + p.spark * 8
        let r2 = r1 + p.spark * 20
        var path = Path()
        for i in 0..<6 {
            let a = (-160 + Double(i) * 28) * Double.pi / 180
            path.move(to: CGPoint(x: 100 + cos(a) * r1, y: 120 + p.y + sin(a) * r1))
            path.addLine(to: CGPoint(x: 100 + cos(a) * r2, y: 120 + p.y + sin(a) * r2))
        }
        let col = rgb(212, 230, 74).opacity(min(1, p.spark * 1.4))
        c.stroke(path, with: .color(col), style: StrokeStyle(lineWidth: 5, lineCap: .round))
    }

    static func ball(_ ctx: GraphicsContext, _ p: AcePose) {
        var c = ctx
        let rect = CGRect(x: 20, y: 40, width: 160, height: 160)
        let shape = Path(ellipseIn: rect)
        let g1 = Gradient(stops: [
            .init(color: rgb(244, 250, 184), location: 0),
            .init(color: rgb(220, 236, 85), location: 0.45),
            .init(color: rgb(191, 210, 58), location: 0.85),
            .init(color: rgb(163, 182, 42), location: 1)
        ])
        c.fill(shape, with: .radialGradient(g1, center: CGPoint(x: 20 + 160 * 0.36, y: 40 + 160 * 0.3), startRadius: 0, endRadius: 160 * 0.78))
        let g2 = Gradient(colors: [rgb(94, 112, 0).opacity(0.28), rgb(94, 112, 0).opacity(0)])
        c.fill(shape, with: .radialGradient(g2, center: CGPoint(x: 20 + 160 * 0.72, y: 40 + 160 * 0.78), startRadius: 0, endRadius: 160 * 0.6))
        c.clip(to: shape)
        face(c, p)
        band(c, p)
        var h = c
        h.translateBy(x: 72, y: 66)
        h.rotate(by: .degrees(-25))
        h.fill(Path(ellipseIn: CGRect(x: -26, y: -14, width: 52, height: 28)), with: .color(Color.white.opacity(0.22)))
    }

    static func face(_ ctx: GraphicsContext, _ p: AcePose) {
        var c = ctx
        c.translateBy(x: p.fx, y: p.fy)
        // La couture de la balle, qui fait le sourire
        let L: Double = 36
        let R: Double = 164
        let Y: Double = 136
        let d = Y + p.smile
        var seam = Path()
        seam.move(to: CGPoint(x: L + 14, y: 52))
        seam.addQuadCurve(to: CGPoint(x: L, y: Y), control: CGPoint(x: L - 16, y: Y - 36))
        seam.addQuadCurve(to: CGPoint(x: R, y: Y), control: CGPoint(x: 100, y: d))
        seam.addQuadCurve(to: CGPoint(x: R - 14, y: 52), control: CGPoint(x: R + 16, y: Y - 36))
        var sc = c
        sc.translateBy(x: 0, y: 2.5)
        sc.stroke(seam, with: .color(rgb(111, 132, 16).opacity(0.35)), style: StrokeStyle(lineWidth: 10, lineCap: .round))
        c.stroke(seam, with: .color(rgb(250, 252, 235)), style: StrokeStyle(lineWidth: 7, lineCap: .round))
        eyes(c, p)
        // Sourcils (concentrée : intérieur bas ; déçue : intérieur haut)
        if p.browA > 0.01 {
            var br = Path()
            br.move(to: CGPoint(x: 64, y: 84)); br.addLine(to: CGPoint(x: 90, y: 84 + p.brow * 7))
            br.move(to: CGPoint(x: 136, y: 84)); br.addLine(to: CGPoint(x: 110, y: 84 + p.brow * 7))
            c.stroke(br, with: .color(rgb(69, 84, 14).opacity(p.browA)), style: StrokeStyle(lineWidth: 5.5, lineCap: .round))
        }
    }

    static func eyes(_ c: GraphicsContext, _ p: AcePose) {
        let ink = rgb(20, 24, 16)
        let eo = 1 - p.happy
        if eo > 0.01 {
            let ry = 13 * max(0.08, p.open)
            let cy = 105 + (13 - ry) * 0.6
            let xs: [Double] = [78 + p.lx * 0.6, 122 + p.lx * 0.6]
            for x in xs {
                c.fill(Path(ellipseIn: CGRect(x: x - 9.5, y: cy - ry, width: 19, height: ry * 2)), with: .color(ink.opacity(eo)))
            }
            if p.open > 0.5 {
                let hx: [Double] = [81 + p.lx, 125 + p.lx]
                for x in hx {
                    c.fill(Path(ellipseIn: CGRect(x: x - 3.4, y: 100 + p.ly - 3.4, width: 6.8, height: 6.8)), with: .color(Color.white.opacity(eo)))
                }
            }
        }
        if p.happy > 0.01 {
            var hp = Path()
            hp.move(to: CGPoint(x: 66, y: 108)); hp.addQuadCurve(to: CGPoint(x: 90, y: 108), control: CGPoint(x: 78, y: 94))
            hp.move(to: CGPoint(x: 110, y: 108)); hp.addQuadCurve(to: CGPoint(x: 134, y: 108), control: CGPoint(x: 122, y: 94))
            c.stroke(hp, with: .color(ink.opacity(p.happy)), style: StrokeStyle(lineWidth: 6.5, lineCap: .round))
        }
    }

    /// Le bandeau (concentrée) descend du haut
    static func band(_ ctx: GraphicsContext, _ p: AcePose) {
        if p.band <= 0.01 { return }
        var c = ctx
        c.translateBy(x: 0, y: (1 - p.band) * -110)
        var bd = Path()
        bd.move(to: CGPoint(x: 10, y: 70))
        bd.addQuadCurve(to: CGPoint(x: 190, y: 70), control: CGPoint(x: 100, y: 46))
        bd.addLine(to: CGPoint(x: 190, y: 88))
        bd.addQuadCurve(to: CGPoint(x: 10, y: 88), control: CGPoint(x: 100, y: 64))
        bd.closeSubpath()
        c.fill(bd, with: .color(rgb(31, 92, 63)))
        var ln = Path()
        ln.move(to: CGPoint(x: 10, y: 79))
        ln.addQuadCurve(to: CGPoint(x: 190, y: 79), control: CGPoint(x: 100, y: 55))
        c.stroke(ln, with: .color(rgb(46, 122, 85)), style: StrokeStyle(lineWidth: 2))
    }
}

