# Montée — retire l'extension widgets iPhone du projet Xcode (build de secours).
# Sert seulement si SANS_WIDGETS_IOS=1 dans Codemagic, par exemple tant que le groupe d'apps
# et le profil de signature des widgets ne sont pas créés sur developer.apple.com.
require 'xcodeproj'
path = ARGV[0] || 'ios/App/App.xcodeproj'
project = Xcodeproj::Project.open(path)
ext = project.targets.find { |t| t.name == 'MonteeWidgetsExtension' }
app = project.targets.find { |t| t.name == 'App' }
if ext && app
  app.dependencies.select { |d| d.target == ext }.each(&:remove_from_project)
  app.build_phases.select { |ph| ph.is_a?(Xcodeproj::Project::Object::PBXCopyFilesBuildPhase) && ph.name == 'Embed Foundation Extensions' }.each do |ph|
    app.build_phases.delete(ph)
    ph.remove_from_project
  end
  project.targets.delete(ext)
  ext.remove_from_project
  project.save
  puts 'Extension widgets retirée.'
else
  puts 'Pas d’extension widgets dans le projet.'
end
