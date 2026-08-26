package `in`.dusky.foundation

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/foundation")
class FoundationController {
    @GetMapping("/error")
    fun exampleError(): Nothing = throw IllegalArgumentException("Foundation validation example")
}

