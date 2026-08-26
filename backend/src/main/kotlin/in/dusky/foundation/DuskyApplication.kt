package `in`.dusky.foundation

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class DuskyApplication

fun main(args: Array<String>) {
    runApplication<DuskyApplication>(*args)
}

