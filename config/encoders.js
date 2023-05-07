module.exports = {
    "libx265": {
        "cname": "libx265",
        "name": "libx265",
        "type": "CPU",
        "special_params": "",
        "quality": "crf",
        "quality_constract": ["-crf"],
        "quality_preset_command": "-preset",
        "quality_preset_constract": ["fast", "medium", "slow"]
    },
    "hevc_nvenc": {
        "cname": "hevc_nvenc",
        "name": "hevc_nvenc",
        "type": "GPU",
        "special_params": "-hwaccel 0",
        "quality": "vbr",
        "quality_command": "-rc:v vbr",
        "quality_constract": ["-cq"],
        "quality_preset_command": "-preset",
        "quality_preset_constract": ["fast", "medium", "slow"]
    },
    "hevc_amf": {
        "cname": "hevc_amf",
        "name": "hevc_amf",
        "type": "GPU",
        "special_params": "-hwaccel 0",
        "quality": "cqp",
        "quality_command": "-rc cqp",
        "quality_constract": ["-qp"],
        "quality_preset_command": "-quality",
        "quality_preset_constract": ["speed", "balanced", "quality"]
    },
}