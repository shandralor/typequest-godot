extends SceneTree

## One-off: render a KayKit cloth banner to a transparent PNG for use as a 2D title
## plate in the menu. Run (needs a GPU, NOT --headless):
##   godot --script res://tools/bake_title_banner.gd
## Output: assets/ui/title_banner.png

const BANNER := "res://assets/kaykit/dungeon/banner_red.gltf"
const OUT := "res://assets/ui/title_banner.png"


func _initialize() -> void:
	var vp := SubViewport.new()
	vp.size = Vector2i(900, 420)   # wide: the banner is laid horizontal
	vp.transparent_bg = true
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	vp.msaa_3d = Viewport.MSAA_4X
	get_root().add_child(vp)

	var banner: Node3D = load(BANNER).instantiate()
	vp.add_child(banner)
	# lay the banner on its side so the pole/mounts are on the LEFT and the cloth
	# runs horizontally; then shift it so its centre is at the origin
	banner.rotation_degrees = Vector3(0, 0, 90)
	banner.position = Vector3(2.13, 0.0, 0.0)

	var we := WorldEnvironment.new()
	var env := Environment.new()
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(1, 1, 1)
	env.ambient_light_energy = 1.1
	we.environment = env
	vp.add_child(we)

	var light := DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-35, -25, 0)
	light.light_energy = 1.0
	vp.add_child(light)

	var cam := Camera3D.new()
	vp.add_child(cam)
	cam.current = true
	cam.fov = 30.0
	# horizontal banner is centred at the origin (~3.2 wide, 1.5 tall); look down -Z
	cam.position = Vector3(0.0, 0.0, 4.2)

	await process_frame
	await process_frame
	await create_timer(0.3).timeout
	var img := vp.get_texture().get_image()
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://assets/ui"))
	var err := img.save_png(ProjectSettings.globalize_path(OUT))
	print("BAKE " + ("OK " if err == OK else "FAIL ") + OUT + " size=" + str(img.get_size()))
	quit()
