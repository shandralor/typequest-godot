class_name ArcheryLocation
extends RefCounted

## Static scenery for the archery range set: a grassy range with a dirt shooting
## lane, the named anchors, a bucket of arrows for flavour, and a framing treeline.
## Pure scenery -- the hero, the target, arrows, mood lighting and all motion stay in
## the composer.

const SceneKit = preload("res://render/scene_kit.gd")
const Nature = preload("res://render/locations/nature.gd")


static func build(rng: RandomNumberGenerator) -> Node3D:
	var root := Node3D.new()
	root.add_child(SceneKit.make_ground(Vector2(50, 60), Color(0.32, 0.47, 0.22)))   # grassy range
	# a dirt shooting lane down the middle
	root.add_child(SceneKit.path_segment(Vector3(0, 0, 6), Vector3(0, 0, -8), 3.0))
	var anchors := {
		"center": Vector3(0, 0, 4),
		"line": Vector3(0, 0, 4),          # the shooting line (the knight)
		"target": Vector3(0, 0.4, -7),     # the target, raised to eye level, downrange
		"path_near": Vector3(0, 0, 4),
		"path_far": Vector3(0, 0, -7),
		"treasure": Vector3(0, 0, -7),
	}
	for n in anchors:
		var m := Marker3D.new()
		m.name = n
		m.position = anchors[n]
		root.add_child(m)
	# a bucket of arrows beside the knight for flavour
	var bucket := SceneKit.instance_path("res://assets/kaykit/hexagon/bucket_arrows.gltf")
	if bucket != null:
		bucket.position = Vector3(1.6, 0, 4.2)
		bucket.scale = Vector3(3, 3, 3)
		root.add_child(bucket)
	Nature.treeline(root, rng, ["Tree_1_A_Color1", "Tree_2_A_Color1", "Tree_3_A_Color1"])
	return root
