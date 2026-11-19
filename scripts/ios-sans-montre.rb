# Montée — retire l'app Apple Watch du projet Xcode (build de secours).
# Sert si SANS_MONTRE_IOS=1 dans Codemagic (tant que l'identifiant fr.montennis.app.watchkitapp
# et son profil ne sont pas prêts), et pour le build simulateur iPhone.
require 'xcodeproj'
path = ARGV[0] || 'ios/App/App.xcodeproj'
project = Xcodeproj::Project.open(path)
w = project.targets.find { |t| t.name == 'MonteeWatch' }
app = project.targets.find { |t| t.name == 'App' }
if w && app
  app.dependencies.select { |d| d.target == w }.each(&:remove_from_project)
  app.build_phases.select { |ph| ph.is_a?(Xcodeproj::Project::Object::PBXCopyFilesBuildPhase) && ph.name == 'Embed Watch Content' }.each do |ph|
    app.build_phases.delete(ph)
    ph.remove_from_project
  end
  project.targets.delete(w)
  w.remove_from_project
  c = project.targets.find { |t| t.name == 'MonteeComplications' }
  if c
    project.targets.delete(c)
    c.remove_from_project
  end
  project.save
  puts 'App Apple Watch retirée.'
else
  puts 'Pas d’app Apple Watch dans le projet.'
end
